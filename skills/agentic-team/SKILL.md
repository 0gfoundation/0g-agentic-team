---
name: agentic-team
description: Agent Team 运营工具箱 for 0G AgenticID——环境快照、链上定价与成员成本模型、prepaid/seal 余额巡检、runway 续航计算、agents.yml 名册管理、健康检查。Use when managing an AgenticID agent team as lead: deploying members, budgeting runtime costs, checking balances/runway, or reading the team roster.
---

# Agentic Team Ops

Lead agent 的团队运营工具。v0.1 全部为**只读**操作（零资金风险）；deploy/stop/deposit 等写操作在 v0.2 加入：SDK 官方 `sealAccount()` TEE 桥已实测验证（须 owner 拍板后才实际使用）。

**运行前提**：本 skill 面向 Prime Agent sealed runtime（kernel venv）——shell CLI（`rlm.skill:cli`）与模块直呼 `await at()` 依赖 runtime 注入的 `rlm`；standalone `pip install` 仅有 Python 函数可用，CLI 入口点不可用。所有 I/O 为同步阻塞（httpx sync），kernel 单次调用无碍，勿在 async 热路径高频轮询。

**数据口径**：合约地址以 attestor `GET /config` 为 source of truth（模块常量仅作断网 fallback，地址可能随重新部署漂移）。`runway()`/`prepaid_balance()` 为链上读数——**乐观上界**，不含链下未结算费用（testnet 实测曾高估 25+ OG）；真实可用额度待 v0.2 接 provider `/api/balance` 的 `available`（需 EIP-191 envelope 签名，`/sign/personal_sign` 可覆盖）。

## 环境

- 主网 attestor: `https://agenticid-mainnet.0g.ai`（`GET /config`）
- RPC: `https://evmrpc.0g.ai`（chain 16661）
- 金库 = lead 的 agentSeal（env `AGENT_SEAL`，默认 lead）
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
| `runway(cpu, mem_gb)` | prepaid 余额按定价能跑多少分钟（⚠️ 乐观上界，不含链下欠费） |
| `roster(path)` | 解析 agents.yml 名册 |

写操作路线（v0.2）: **SDK 官方 TEE 桥 `sealAccount()`**（`@0gfoundation/0g-agenticid-sdk/seal` 子路径导出）——完整的 viem LocalAccount 直连 `unix://$SEAL_SIGN_SOCK`，三签名端点全桥接；`AgenticID.fromAttestor(url, {account: await sealAccount()})` 后 SDK 全量写操作可用。⚠️ 勿手搓 account 对象：viem 的 `toAccount()` 形状（source/sign/serializer hooks）在发送路径深处有隐含要求，官方 `sealAccount()` 就是为这准备的（2026-09-11 实测通过：ack 上链 / effective balance / deploy envelope）。签名仅限 lead 自主起草的动作。已验证工具链在 repo `scripts/team-ops/`。

## 测试

`python tests/test_golden.py` —— services()/getBalance() 解码 golden vector（2026-09-11 主网实抓）+ 字段名回归。

## 红线

金库私钥永不出 TEE；签名仅用于自己起草的动作；扩编/reset 须 owner 批。
