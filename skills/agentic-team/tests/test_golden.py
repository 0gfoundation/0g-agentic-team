"""Golden-vector tests (no pytest dependency — run: python tests/test_golden.py).

Vector source: live eth_call captures on mainnet 2026-09-11
(SandboxServing.services(provider); stable after contract deployment → a stable golden).
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "src"))
import agentic_team as at  # noqa: E402

# 2026-09-11 mainnet eth_call: services(0x7bad25f8...) → raw
GOLDEN_SERVICES_RAW = "0x00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000038d7ea4c680000000000000000000000000000000000000000000000000000001c6bf52634000000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000000001968747470733a2f2f6172742d6d61696e6e65742e30672e616900000000000000000000000000000000000000000000000000000000000000000000000000001e30672d6167656e7469632d69642d73616e64626f782d70726f76696465720000"
GOLDEN_SERVICES = {
    "endpoint": "https://art-mainnet.0g.ai",
    "app_id": "0g-agentic-id-sandbox-provider",
    "cpu_per_min_og": 0.001,
    "mem_gb_per_min_og": 0.0005,
    "create_fee_og": 0.01,
}

# getBalance(0x0) → an all-zero triple (decode logic and field-name test)
GOLDEN_BAL_RAW = "0x" + "00" * 96
GOLDEN_BAL = {"balance_og": 0.0, "pending_refund_og": 0.0, "refund_unlock_at": 0}

# one non-zero unlock: 0x67e3d1c0 ≈ 2025-03-30 (timestamp semantics)
GOLDEN_BAL_RAW2 = "0x" + "00" * 64 + "0000000000000000000000000000000000000000000000000000000067e3d1c0"


def main() -> int:
    fails = []

    got = at._decode_services(GOLDEN_SERVICES_RAW)
    if got != GOLDEN_SERVICES:
        fails.append(f"services decode mismatch:\n  got      {got}\n  expected {GOLDEN_SERVICES}")

    got2 = at._decode_getbalance(GOLDEN_BAL_RAW)
    if got2 != GOLDEN_BAL:
        fails.append(f"getbalance decode mismatch: {got2}")

    got3 = at._decode_getbalance(GOLDEN_BAL_RAW2)
    if got3["refund_unlock_at"] != 0x67e3d1c0:
        fails.append(f"refund_unlock_at (unix ts) decode mismatch: {got3}")

    # cost_model note: 24h always-on must not claim "~Nx savings"
    cm = at.cost_model(hours_per_day=24)
    if "~" in cm["note"]:
        fails.append(f"cost_model note at 24h should not claim savings: {cm['note']}")
    cm2 = at.cost_model(hours_per_day=4)
    if "saves ~6x" not in cm2["note"]:
        fails.append(f"cost_model note at 4h/d expected 'saves ~6x': {cm2['note']}")

    # field-name regression: the old refund_unlock_block must never reappear
    import inspect
    src = inspect.getsource(at)
    if "refund_unlock_block" in src:
        fails.append("stale field name refund_unlock_block still in source")

    if fails:
        print("FAIL:\n" + "\n".join(fails))
        return 1
    print("all golden tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
