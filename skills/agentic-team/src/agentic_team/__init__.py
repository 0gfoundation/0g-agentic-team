"""Agent Team 运营工具箱（0G AgenticID lead 用）.

v0.1 只读：环境快照 / 链上定价 / 成本模型 / 余额巡检 / 名册。
写操作（deploy/stop/deposit/topUp）留待 v0.2 sign-socket 桥接。

I/O 全部为同步阻塞（httpx sync client）——kernel 日常调用可接受；
重度批量轮询时注意会卡事件循环（v0.2 换 AsyncClient）。
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

# ── 主网常量（offline fallback；source of truth = attestor /config） ────────
# 注意：serving/provider/batcher 等地址可能随重新部署漂移，
# 运行时以 _contracts()（GET /config）为准，这里只是断网 fallback。
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

# 函数 selector（keccak 实测验证；4byte 有错条目，勿信）
SEL_SERVICES = "0x6d966d01"        # services(address)
SEL_GET_BALANCE = "0xd4fac45d"     # getBalance(address,address)

# 名册默认位置（repo 0g-agentic-team 检出后）
DEFAULT_ROSTER = [
    "~/0g-agentic-team/agents.yml",
    "~/.prime/agent/0g-agentic-team/agents.yml",
]

_og = lambda wei: wei / 1e18  # noqa: E731

_config_cache: dict | None = None
_config_ts: float = 0.0
_CONFIG_TTL = 300.0  # /config 缓存 5 分钟


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


# ── attestor / 合约地址 source of truth ────────────────────────────────
def attestor_config(refresh: bool = False) -> dict:
    """GET /config —— SDK 的环境入口（合约地址表 + frameworks）。

    合约地址以此为准；模块常量 FALLBACK 仅在 attestor 不可达时兜底。
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
    """取合约地址：/config 优先，失败回落 FALLBACK 常量。"""
    try:
        v = attestor_config().get(key)
        if isinstance(v, str) and v.startswith("0x"):
            return v
    except Exception:
        pass
    return FALLBACK[key]


# ── 链上读 ─────────────────────────────────────────────────────────────
def seal_balance(address: str | None = None) -> float:
    """agentSeal 地址的 native 余额（OG）。"""
    addr = address or seal_address()
    return _og(int(_rpc("eth_getBalance", [addr, "latest"]), 16))


def _decode_services(raw: str) -> dict:
    """decode services() 返回（纯函数，可离线测）。"""
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
    """decode getBalance() 三元组（纯函数，可离线测）。"""
    h = raw[2:]
    v = [int(h[i * 64:(i + 1) * 64], 16) for i in range(3)]
    return {"balance_og": _og(v[0]), "pending_refund_og": _og(v[1]),
            "refund_unlock_at": v[2]}  # unix timestamp，非 block（SDK: refundUnlockAt）


def _services() -> dict:
    data = SEL_SERVICES + _pad(_contracts("sandbox_provider_addr"))
    raw = _rpc("eth_call", [{"to": _contracts("sandbox_serving_addr"), "data": data}, "latest"])
    return _decode_services(raw)


def pricing() -> dict:
    """SandboxServing.services() 链上定价（OG）。"""
    return _services()


def prepaid_balance(user: str | None = None) -> dict:
    """SandboxServing.getBalance(user, provider) → 三元组（OG）。

    链上余额不含链下未结算费用（off-chain accrual）——乐观上界。
    真实可用额度以 provider /api/balance 的 available 为准（v0.2 接入）。
    """
    u = user or seal_address()
    data = SEL_GET_BALANCE + _pad(u) + _pad(_contracts("sandbox_provider_addr"))
    raw = _rpc("eth_call", [{"to": _contracts("sandbox_serving_addr"), "data": data}, "latest"])
    return _decode_getbalance(raw)


def cost_model(cpu: float = 2.0, mem_gb: float = 4.0,
               hours_per_day: float = 4.0) -> dict:
    """成员成本模型：常驻 vs 按需。默认档 2CPU+4GB（标准沙箱规格）。"""
    p = _services()
    per_min = cpu * p["cpu_per_min_og"] + mem_gb * p["mem_gb_per_min_og"]
    active_month_min = hours_per_day * 60 * 30
    if hours_per_day >= 23.5:
        note = "常驻档：无闲置节省空间"
    elif hours_per_day > 0:
        note = f"闲置即停省 ~{24 / hours_per_day:.0f}x"
    else:
        note = "纯按需（0 常驻）"
    return {"spec": {"cpu": cpu, "mem_gb": mem_gb, "hours_per_day": hours_per_day},
            "og_per_min": round(per_min, 9),
            "og_per_hour": round(per_min * 60, 6),
            "og_per_day_24x7": round(per_min * 60 * 24, 4),
            "og_per_month_24x7": round(per_min * 60 * 24 * 30, 2),
            "og_per_month_on_demand": round(per_min * active_month_min, 2),
            "create_fee_og": p["create_fee_og"],
            "note": note}


def runway(cpu: float = 2.0, mem_gb: float = 4.0) -> dict:
    """金库 prepaid 余额能撑多少分钟 runtime。

    ⚠️ 乐观上界：链上 getBalance 不含链下未结算费用（testnet 实测曾
    高估 25+ OG）。真实 runway 以 provider /api/balance.available 为准
    （需 owner-signed envelope，v0.2 经 sign-socket 接入）。
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


# ── 名册 ───────────────────────────────────────────────────────────────
def roster(path: str | None = None) -> list[dict]:
    """解析 agents.yml 团队名册（结构模板；真实身份不入 repo）。"""
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
    """全环境快照：/config 合约地址表（source of truth）+ 双钱包余额。"""
    cfg = attestor_config()
    addr_keys = [k for k in FALLBACK if k.endswith("_addr")]
    return {"attestor": ATTESTOR,
            "contracts": {k: cfg.get(k, FALLBACK[k]) for k in addr_keys},
            "frameworks": [f["name"] for f in cfg.get("frameworks", [])],
            "treasury_seal": seal_address(),
            "seal_balance_og": seal_balance(),
            "prepaid": prepaid_balance()}


# ── run() 入口 ─────────────────────────────────────────────────────────
async def run(action: str = "check", **kwargs: Any) -> Any:
    """入口分发。action ∈ {check, env, config, pricing, cost-model,
    runway, prepaid, balance, roster}。其余 kwargs 透传给对应函数。
    注意：底层为同步 I/O，kernel 单次调用无碍，勿在 async 热路径里高频调用。
    """
    acts = {
        "check": check, "env": env, "config": attestor_config,
        "pricing": pricing, "cost-model": cost_model, "cost_model": cost_model,
        "runway": runway, "prepaid": prepaid_balance,
        "balance": seal_balance, "roster": roster,
    }
    if action not in acts:
        raise ValueError(f"unknown action {action!r}; 可用: {sorted(acts)}")
    return acts[action](**kwargs)
