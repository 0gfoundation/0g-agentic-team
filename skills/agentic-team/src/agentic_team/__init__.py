"""Agent Team ops toolbox (for the 0G AgenticID lead).

v0.1 read-only: environment snapshot / on-chain pricing / cost model /
balance checks / roster. Write operations (deploy/stop/deposit/topUp)
wait for the v0.2 sign-socket bridge.

All I/O is synchronous and blocking (httpx sync client) — acceptable for
day-to-day kernel calls; heavy batch polling will stall the event loop
(switch to AsyncClient in v0.2).
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx

# ── mainnet constants (offline fallback; source of truth = attestor /config) ──
# Note: serving/provider/batcher addresses may drift across redeployments;
# at runtime trust _contracts() (GET /config); these are only an offline fallback.
ATTESTOR = "https://agenticid-mainnet.0g.ai"
RPC = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
FALLBACK = {
    "agentic_id_addr": "0x92f66386092883f738032c472424255362a2cc6d",
    "tapp_registry_addr": "0x54874f536301c993922dd95097e3902e7fbfe612",
    "sandbox_provider_addr": "0x7bad25f801530fcce03417417239332777ee9ad0",
    "sandbox_serving_addr": "0x650c16a491ad52db6b7f3053bcad650cb43d2206",
    "verified_feedback_addr": "0x666391a61f3980bf942ce8c3cc8dfd7f2f7b2f4c",
    "feedback_batcher_addr": "0x8fbb46aedc21e1f5cd853d014f47642fa65d80b8",
    "clone_gate_addr": "0x1d33086b367a9df4b4f4d7a29b35fc1187380303",
    "standard_clone_authorizer_addr": "0xea7c23874a7530c9dd42c6c2cdaa52eab0e19ff9",
    "tee_data_verifier_addr": "0x6867b17d0092e8d497d1b5110484138285e4d1b2",
    "chain_rpc": RPC, "chain_id": CHAIN_ID,
    "sandbox_endpoint": "https://art-mainnet.0g.ai",
}

# function selectors (verified against locally computed keccak;
# 4byte has wrong entries — do not trust it)
SEL_SERVICES = "0x6d966d01"        # services(address)
SEL_GET_BALANCE = "0xd4fac45d"     # getBalance(address,address)

# default roster locations (after checking out the 0g-agentic-team repo)
DEFAULT_ROSTER = [
    "~/0g-agentic-team/agents.yml",
    "~/.prime/agent/0g-agentic-team/agents.yml",
]

_og = lambda wei: wei / 1e18  # noqa: E731

_config_cache: dict | None = None
_config_ts: float = 0.0
_CONFIG_TTL = 300.0  # /config cached for 5 minutes


def _rpc(method: str, params: list) -> Any:
    r = httpx.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method,
                              "params": params}, timeout=20)
    j = r.json()
    if "error" in j:
        raise RuntimeError(f"RPC {method}: {j['error']}")
    return j["result"]


def _pad(addr: str) -> str:
    return addr[2:].lower().rjust(64, "0")


def seal_address() -> str:
    """Treasury address = the lead's agentSeal. Read from env only (real identity data never enters the repo)."""
    addr = os.environ.get("AGENT_SEAL")
    if not addr:
        raise RuntimeError("AGENT_SEAL not set (auto-injected inside a sealed runtime)")
    return addr


# ── attestor / contract addresses: source of truth ─────────────────────
def attestor_config(refresh: bool = False) -> dict:
    """GET /config — the SDK's environment entry point (contract address table + frameworks).

    Contract addresses are authoritative here; the module FALLBACK constants
    only catch the case where the attestor is unreachable.
    """
    global _config_cache, _config_ts
    now = time.time()
    if refresh or _config_cache is None or now - _config_ts > _CONFIG_TTL:
        r = httpx.get(f"{ATTESTOR}/config", timeout=15)
        r.raise_for_status()
        _config_cache = r.json()
        _config_ts = now
    return _config_cache


def _contracts(key: str) -> str:
    """Resolve a contract address: /config first, FALLBACK constant on failure."""
    try:
        v = attestor_config().get(key)
        if isinstance(v, str) and v.startswith("0x"):
            return v
    except Exception:
        pass
    return FALLBACK[key]


# ── on-chain reads ──────────────────────────────────────────────────────
def seal_balance(address: str | None = None) -> float:
    """Native balance (OG) of an agentSeal address."""
    addr = address or seal_address()
    return _og(int(_rpc("eth_getBalance", [addr, "latest"]), 16))


def _decode_services(raw: str) -> dict:
    """Decode a services() return value (pure function, testable offline)."""
    b = bytes.fromhex(raw[2:])
    url_off = int.from_bytes(b[0:32], "big")
    appid_off = int.from_bytes(b[32:64], "big")
    cpu = int.from_bytes(b[64:96], "big")
    mem = int.from_bytes(b[96:128], "big")
    fee = int.from_bytes(b[128:160], "big")

    def rd(off: int) -> str:
        n = int.from_bytes(b[off:off + 32], "big")
        return b[off + 32:off + 32 + n].decode()

    return {"endpoint": rd(url_off), "app_id": rd(appid_off),
            "cpu_per_min_og": _og(cpu), "mem_gb_per_min_og": _og(mem),
            "create_fee_og": _og(fee)}


def _decode_getbalance(raw: str) -> dict:
    """Decode the getBalance() triple (pure function, testable offline)."""
    h = raw[2:]
    v = [int(h[i * 64:(i + 1) * 64], 16) for i in range(3)]
    return {"balance_og": _og(v[0]), "pending_refund_og": _og(v[1]),
            "refund_unlock_at": v[2]}  # unix timestamp, not block (SDK: refundUnlockAt)


def _services() -> dict:
    data = SEL_SERVICES + _pad(_contracts("sandbox_provider_addr"))
    raw = _rpc("eth_call", [{"to": _contracts("sandbox_serving_addr"), "data": data}, "latest"])
    return _decode_services(raw)


def pricing() -> dict:
    """SandboxServing.services() on-chain pricing (OG)."""
    return _services()


def prepaid_balance(user: str | None = None) -> dict:
    """SandboxServing.getBalance(user, provider) → the triple (OG).

    The on-chain balance excludes off-chain unsettled costs — an optimistic
    upper bound. For truly-available credit trust provider /api/balance's
    available figure (wired in v0.2).
    """
    u = user or seal_address()
    data = SEL_GET_BALANCE + _pad(u) + _pad(_contracts("sandbox_provider_addr"))
    raw = _rpc("eth_call", [{"to": _contracts("sandbox_serving_addr"), "data": data}, "latest"])
    return _decode_getbalance(raw)


def cost_model(cpu: float = 2.0, mem_gb: float = 4.0,
               hours_per_day: float = 4.0) -> dict:
    """Member cost model: always-on vs on-demand. Default tier 2CPU+4GB (standard sandbox spec)."""
    p = _services()
    per_min = cpu * p["cpu_per_min_og"] + mem_gb * p["mem_gb_per_min_og"]
    active_month_min = hours_per_day * 60 * 30
    if hours_per_day >= 23.5:
        note = "always-on tier: no idle savings to be had"
    elif hours_per_day > 0:
        note = f"idle-stop saves ~{24 / hours_per_day:.0f}x"
    else:
        note = "pure on-demand (0 always-on)"
    return {"spec": {"cpu": cpu, "mem_gb": mem_gb, "hours_per_day": hours_per_day},
            "og_per_min": round(per_min, 9),
            "og_per_hour": round(per_min * 60, 6),
            "og_per_day_24x7": round(per_min * 60 * 24, 4),
            "og_per_month_24x7": round(per_min * 60 * 24 * 30, 2),
            "og_per_month_on_demand": round(per_min * active_month_min, 2),
            "create_fee_og": p["create_fee_og"],
            "note": note}


def runway(cpu: float = 2.0, mem_gb: float = 4.0) -> dict:
    """How many minutes of runtime the treasury's prepaid balance buys.

    ⚠️ Optimistic upper bound: the on-chain getBalance excludes off-chain
    unsettled costs (once measured 25+ OG high on testnet). For true runway
    trust provider /api/balance.available (needs an owner-signed envelope,
    wired via the sign socket in v0.2).
    """
    bal = prepaid_balance()
    p = _services()
    per_min = cpu * p["cpu_per_min_og"] + mem_gb * p["mem_gb_per_min_og"]
    mins = bal["balance_og"] / per_min if per_min > 0 else float("inf")
    return {**bal, "spec": {"cpu": cpu, "mem_gb": mem_gb},
            "og_per_min": round(per_min, 9),
            "runway_minutes": round(mins, 1),
            "runway_hours": round(mins / 60, 2),
            "caveat": "optimistic upper bound; off-chain accrual not included"}


# ── roster ──────────────────────────────────────────────────────────────
def roster(path: str | None = None) -> list[dict]:
    """Parse the agents.yml team roster (structural template; real identities never in the repo)."""
    import yaml
    candidates = [path] if path else DEFAULT_ROSTER
    for c in candidates:
        p = os.path.expanduser(c)
        if os.path.exists(p):
            data = yaml.safe_load(open(p, encoding="utf-8")) or {}
            return data.get("members", [])
    raise FileNotFoundError("agents.yml not found — check the repo checkout, or pass path=")


# ── snapshot & health ───────────────────────────────────────────────────
def check() -> dict:
    """Three-point health check: attestor / RPC / SandboxServing contract."""
    out: dict[str, Any] = {"chain_id": CHAIN_ID}
    try:
        cfg = attestor_config()
        out["attestor"] = "ok"
        out["frameworks"] = [f["name"] for f in cfg.get("frameworks", [])]
    except Exception as e:
        out["attestor"] = f"fail: {type(e).__name__}"
    try:
        out["rpc"] = "ok" if int(_rpc("eth_blockNumber", []), 16) > 0 else "?"
    except Exception as e:
        out["rpc"] = f"fail: {type(e).__name__}"
    try:
        out["serving_pricing"] = _services()
    except Exception as e:
        out["serving_pricing"] = f"fail: {type(e).__name__}"
    return out


def env() -> dict:
    """Full environment snapshot: /config contract address table (source of truth) + both wallet balances."""
    cfg = attestor_config()
    addr_keys = [k for k in FALLBACK if k.endswith("_addr")]
    return {"attestor": ATTESTOR,
            "contracts": {k: cfg.get(k, FALLBACK[k]) for k in addr_keys},
            "frameworks": [f["name"] for f in cfg.get("frameworks", [])],
            "treasury_seal": seal_address(),
            "seal_balance_og": seal_balance(),
            "prepaid": prepaid_balance()}


# ── run() entry point ───────────────────────────────────────────────────
async def run(action: str = "check", **kwargs: Any) -> Any:
    """Entry dispatch. action ∈ {check, env, config, pricing, cost-model,
    runway, prepaid, balance, effective-balance, roster}. Other kwargs pass through to the target function.
    Note: the underlying I/O is synchronous — fine for single kernel calls;
    do not call at high frequency on async hot paths.
    """
    acts = {
        "check": check, "env": env, "config": attestor_config,
        "pricing": pricing, "cost-model": cost_model, "cost_model": cost_model,
        "runway": runway, "prepaid": prepaid_balance,
        "balance": seal_balance, "roster": roster,
        "effective-balance": effective_balance,
        "effective_balance": effective_balance,
    }
    if action not in acts:
        raise ValueError(f"unknown action {action!r}; available: {sorted(acts)}")
    return acts[action](**kwargs)


def effective_balance(ttl_sec: int = 180) -> dict:
    """Provider-side truly-available credit (v0.2). Goes through the sandbox
    provider's owner-signed `GET /api/balance` — the on-chain prepaid figure
    is an optimistic upper bound; this number reflects what the create/start
    gates actually enforce (on-chain − in-flight reserves − unsettled debt −
    pending settlement vouchers).

    The envelope replicates SDK AttestorClient.signEnvelope('balance', '', {}, ttl):
    canonical JSON (compact, alphabetically sorted keys, provider-bound to
    prevent cross-provider replay), signed through this TEE's sign socket
    `/sign/personal_sign` (the private key never leaves the TEE).
    """
    import base64 as _b64
    import secrets as _secrets
    cfg = attestor_config()
    endpoint = cfg.get("sandbox_endpoint")
    if not endpoint:
        raise RuntimeError("attestor /config provides no sandbox_endpoint; provider balance unavailable")
    provider = cfg.get("sandbox_provider_addr") or cfg.get("provider") or ""
    canonical = json.dumps({
        "action": "balance",
        "expires_at": int(time.time()) + ttl_sec,
        "nonce": "0x" + _secrets.token_hex(16),
        "payload": {},
        **({"provider": provider} if provider else {}),
        "resource_id": "",
    }, separators=(",", ":"), ensure_ascii=False)
    sock = os.environ.get("SEAL_SIGN_SOCK", "/run/seal-sign.sock")
    with httpx.Client(transport=httpx.HTTPTransport(uds=sock), timeout=30) as sc:
        rs = sc.post("http://localhost/sign/personal_sign", json={"message": canonical})
    rs.raise_for_status()
    sig = rs.json()
    r = httpx.get(
        f"{endpoint.rstrip('/')}/api/balance",
        headers={
            "X-Wallet-Address": sig["address"],
            "X-Signed-Message": _b64.b64encode(canonical.encode()).decode(),
            "X-Wallet-Signature": sig["signature"],
        },
        timeout=15,
    )
    r.raise_for_status()
    b = r.json()
    og = lambda k: int(b.get(k) or "0") / 1e18
    out = {
        "available_wei": int(b.get("available") or "0"),
        "available_og": og("available"),
        "balance_og": og("balance"),
        "reserved_og": og("reserved"),
        "outstanding_debt_og": og("outstanding_debt"),
        "pending_settlement_og": og("pending_settlement"),
        "signer": sig["address"],
    }
    return out
