"""Agent Team 运营工具箱（0G AgenticID lead 用）.

v0.1 只读：环境快照 / 链上定价 / 成本模型 / 余额巡检 / 名册。
写操作（deploy/stop/deposit/topUp）留待 v0.2 sign-socket 桥接。
"""

from __future__ import annotations

import os
from typing import Any

import httpx

# ── 主网常量（2026-09-10 实测） ────────────────────────────────────────────
ATTESTOR = "https://agenticid-mainnet.0g.ai"
RPC = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
AGENTIC_ID = "0x92f66386092883f738032c472424255362a2cc6d"
SANDBOX_SERVING = "0x650c16a491ad52db6b7f3053bcad650cb43d2206"
SANDBOX_PROVIDER = "0x7bad25f801530fcce03417417239332777ee9ad0"
TAPP_REGISTRY = "0x54874f536301c993922dd95097e3902e7fbfe612"
VERIFIED_FEEDBACK = "0x666391a61f3980bf942ce8c3cc8dfd7f2f7b2f4c"

# 函数 selector（keccak 实测验证；4byte 有错条目，勿信）
SEL_SERVICES = "0x6d966d01"        # services(address)
SEL_GET_BALANCE = "0xd4fac45d"     # getBalance(address,address)
SEL_SERVICE_EXISTS = "0x0a2a8f88"  # serviceExists(address)

# 名册默认位置（repo 0g-agentic-team 检出后）
DEFAULT_ROSTER = [
    "~/0g-agentic-team/agents.yml",
    "~/.prime/agent/0g-agentic-team/agents.yml",
]

_og = lambda wei: wei / 1e18  # noqa: E731


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
    """金库地址 = lead 的 agentSeal。仅从 env 读取（真实身份信息不入 repo）。"""
    addr = os.environ.get("AGENT_SEAL")
    if not addr:
        raise RuntimeError("AGENT_SEAL 未设置（sealed runtime 内自动注入）")
    return addr


# ── attestor ───────────────────────────────────────────────────────────
def attestor_config() -> dict:
    """GET /config —— SDK 的环境入口（合约地址表 + frameworks）。"""
    r = httpx.get(f"{ATTESTOR}/config", timeout=15)
    r.raise_for_status()
    return r.json()


# ── 链上读 ─────────────────────────────────────────────────────────────
def seal_balance(address: str | None = None) -> float:
    """agentSeal 地址的 native 余额（OG）。"""
    addr = address or seal_address()
    return _og(int(_rpc("eth_getBalance", [addr, "latest"]), 16))


def _services() -> dict:
    raw = _rpc("eth_call", [{"to": SANDBOX_SERVING,
                             "data": SEL_SERVICES + _pad(SANDBOX_PROVIDER)},
                            "latest"])
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


def pricing() -> dict:
    """SandboxServing.services() 链上定价（OG）。"""
    return _services()


def prepaid_balance(user: str | None = None) -> dict:
    """SandboxServing.getBalance(user, provider) → 三元组（OG）。"""
    u = user or seal_address()
    raw = _rpc("eth_call", [{"to": SANDBOX_SERVING,
                             "data": SEL_GET_BALANCE + _pad(u) + _pad(SANDBOX_PROVIDER)},
                            "latest"])
    b = raw[2:]
    v = [int(b[i * 64:(i + 1) * 64], 16) for i in range(3)]
    return {"balance_og": _og(v[0]), "pending_refund_og": _og(v[1]),
            "refund_unlock_block": v[2]}


def cost_model(cpu: float = 2.0, mem_gb: float = 4.0,
               hours_per_day: float = 4.0) -> dict:
    """成员成本模型：常驻 vs 按需。默认档 2CPU+4GB（标准沙箱规格）。"""
    p = _services()
    per_min = cpu * p["cpu_per_min_og"] + mem_gb * p["mem_gb_per_min_og"]
    active_month_min = hours_per_day * 60 * 30
    return {"spec": {"cpu": cpu, "mem_gb": mem_gb, "hours_per_day": hours_per_day},
            "og_per_min": round(per_min, 9),
            "og_per_hour": round(per_min * 60, 6),
            "og_per_day_24x7": round(per_min * 60 * 24, 4),
            "og_per_month_24x7": round(per_min * 60 * 24 * 30, 2),
            "og_per_month_on_demand": round(per_min * active_month_min, 2),
            "create_fee_og": p["create_fee_og"],
            "note": "闲置即停省 ~{:.0f}x".format(
                (24 / max(hours_per_day, 0.01)))}


def runway(cpu: float = 2.0, mem_gb: float = 4.0) -> dict:
    """金库 prepaid 余额能撑多少分钟 runtime。"""
    bal = prepaid_balance()
    p = _services()
    per_min = cpu * p["cpu_per_min_og"] + mem_gb * p["mem_gb_per_min_og"]
    mins = bal["balance_og"] / per_min if per_min > 0 else float("inf")
    return {**bal, "spec": {"cpu": cpu, "mem_gb": mem_gb},
            "og_per_min": round(per_min, 9),
            "runway_minutes": round(mins, 1),
            "runway_hours": round(mins / 60, 2)}


# ── 名册 ───────────────────────────────────────────────────────────────
def roster(path: str | None = None) -> list[dict]:
    """解析 agents.yml 团队名册。"""
    import yaml
    candidates = [path] if path else DEFAULT_ROSTER
    for c in candidates:
        p = os.path.expanduser(c)
        if os.path.exists(p):
            data = yaml.safe_load(open(p, encoding="utf-8")) or {}
            return data.get("members", [])
    raise FileNotFoundError("agents.yml 未找到，检查 repo 是否检出；或传 path=")


# ── 快照与健康 ─────────────────────────────────────────────────────────
def check() -> dict:
    """三点健康检查：attestor / RPC / SandboxServing 合约。"""
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
    """全环境快照：config 地址表 + 双钱包余额。"""
    cfg = attestor_config()
    return {"attestor": ATTESTOR, "rpc": RPC, "chain_id": CHAIN_ID,
            "contracts": {k: cfg.get(k) for k in (
                "agentic_id_addr", "tapp_registry_addr",
                "sandbox_provider_addr", "sandbox_serving_addr",
                "verified_feedback_addr", "clone_gate_addr")},
            "frameworks": [f["name"] for f in cfg.get("frameworks", [])],
            "treasury_seal": seal_address(),
            "seal_balance_og": seal_balance(),
            "prepaid": prepaid_balance()}


# ── run() 入口 ─────────────────────────────────────────────────────────
async def run(action: str = "check", **kwargs: Any) -> Any:
    """入口分发。action ∈ {check, env, config, pricing, cost-model,
    runway, prepaid, balance, roster}。其余 kwargs 透传给对应函数。"""
    acts = {
        "check": check, "env": env, "config": attestor_config,
        "pricing": pricing, "cost-model": cost_model, "cost_model": cost_model,
        "runway": runway, "prepaid": prepaid_balance,
        "balance": seal_balance, "roster": roster,
    }
    if action not in acts:
        raise ValueError(f"unknown action {action!r}; 可用: {sorted(acts)}")
    return acts[action](**kwargs)
