---
name: agentic-team
description: Agent Team 运营工具箱 for 0G AgenticID——环境快照、链上定价与成员成本模型、prepaid/seal 余额巡检、runway 续航计算、agents.yml 名册管理、健康检查。Use when managing an AgenticID agent team as lead: deploying members, budgeting runtime costs, checking balances/runway, or reading the team roster.
---

# Agentic Team Ops

Lead agent 的团队运营工具。v0.1 全部为**只读**操作（零资金风险）；deploy/stop/deposit 等写操作在 v0.2 经 sign-socket 桥接后加入（须 owner 拍板后才实际使用）。

## 环境

- 主网 attestor: `https://agenticid-mainnet.0g.ai`（`GET /config`）
- RPC: `https://evmrpc.0g.ai`（chain 16661）
- 金库 = lead 的 agentSeal（env `AGENT_SEAL`，默认 xm-p）
- 名册: repo `0g-agentic-team` 的 `agents.yml`

## 从内核调用

```python
import agentic_team as at

await at()                       # 默认 action="check" 健康检查
await at(action="env")           # 全环境快照（config+合约+余额）
at.pricing()                     # 链上定价（CPU/内存/创建费, OG）
at.cost_model()                                    # 成员月成本（默认 2CPU+4GB）
at.runway()                      # 金库 prepaid 余额与续航分钟
at.roster()                      # 团队名册（agents.yml）
```

## 从 shell 调用

    agentic_team check
    agentic_team env
    agentic_team pricing
    agentic_team cost-model --cpu 1 --mem-gb 1 --hours-per-day 4

## 函数一览

| 函数 | 干什么 |
|---|---|
| `check()` | attestor/RPC/合约 三点健康检查 |
| `env()` | 环境快照: attestor config + 地址表 + seal/prepaid 余额 |
| `attestor_config()` | 原始 `GET /config` |
| `pricing()` | SandboxServing.services() 链上定价 |
| `cost_model(cpu, mem_gb, hours_per_day)` | 成本测算 → 每分钟/小时/天/月 OG（默认 2c4g）|
| `seal_balance(address)` | agentSeal 地址的 native 余额 |
| `prepaid_balance(user)` | SandboxServing 三元组余额 |
| `runway(cpu, mem_gb)` | prepaid 余额按定价能跑多少分钟 |
| `roster(path)` | 解析 agents.yml 名册 |

写操作路线（v0.2）: viem 自定义 account 桥接 `unix://$SEAL_SIGN_SOCK`（`/sign/personal_sign`、`/sign/typed_data`、`/sign/transaction`），覆盖 SDK 的 envelope 签名与链上交易。签名仅限 lead 自主起草的动作。

## 红线

金库私钥永不出 TEE；签名仅用于自己起草的动作；扩编/reset 须 owner 批。
