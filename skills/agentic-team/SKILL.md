---
name: agentic-team
description: Agent Team 运营工具箱 for 0G AgenticID——环境快照、链上定价与成员成本模型、prepaid/seal 余额巡检、runway 续航计算、agents.yml 名册管理、健康检查。Use when managing an AgenticID agent team as lead: deploying members, budgeting runtime costs, checking balances/runway, or reading the team roster.
---

# Agentic Team Ops

Lead agent 的团队运营工具。v0.2：新增 `effective_balance()`——provider 侧真实可用额度（纯 Python 复刻 SDK envelope，经本 TEE sign socket 签署，零 node 依赖）。其余仍为只读；写操作（deploy/start/stop/deposit/ack/chat 派活）经 `scripts/team-ops/` 的 node 脚本（SDK 官方 `sealAccount()`，须 owner 拍板后使用）。

**运行前提**：本 skill 面向 Prime Agent sealed runtime（kernel venv）——shell CLI（`rlm.skill:cli`）与模块直呼 `await at()` 依赖 runtime 注入的 `rlm`；standalone `pip install` 仅有 Python 函数可用，CLI 入口点不可用。所有 I/O 为同步阻塞（httpx sync），kernel 单次调用无碍，勿在 async 热路径高频轮询。

**数据口径**：合约地址以 attestor `GET /config` 为 source of truth（模块常量仅作断网 fallback，地址可能随重新部署漂移）。`runway()`/`prepaid_balance()` 为链上读数——**乐观上界**（不含链下未结算费用，实测曾高估 25+ OG）；**真实可用额度用 `effective_balance()`**（provider `/api/balance`，envelope 经 `/sign/personal_sign`）。巡检时两者都看：链上 > provider 可用 = 有未结算欠费在途。

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


## v0.2 新增：实测沉淀（2026-09-11 建队实测）

### effective_balance()

```python
at.effective_balance()   # → available_og / balance_og / reserved / outstanding_debt / pending_settlement
```

envelope 规格复刻 SDK `AttestorClient.signEnvelope('balance','',{},180)`：canonical JSON 紧凑无空格、key 字母序、`sandbox_provider_addr` 绑定防跨 provider 重放；`resource_id` 为空串。

### chat 派活 SOP（踩坑换来的）

- **拆小卡**：每卡单一动作包（≤~5 分钟）。整卡派活必被网关掐（~300s 无字节断连；bridge 把断连当 OpenAI cancel → **中止成员 turn**，半途而废）。
- 工具活动（ipython update 事件）有字节流→连接稳；纯 reasoning 段超 ~300s 无字节→被掐。**Python 侧 subprocess timeout ≥1500s**，别自杀连接。
- 被掐后发**续接卡**（"前 N 步已做完，只做剩余步骤"）——成员 ipython 变量跨 turn 存活，可复用。
- 排障：`c.logs({tail:N})`（owner-signed `/log/agent`）看成员 bridge 日志；`listMyDeployments` 看 phase（**等 `phase=='running'`，url 在 deploying 阶段就出现，别见 url 就当活**）。

### 成员部署：镜像选择

`/config` 的 frameworks[] 每框架有专属 image——`start(sealId, {apiKey, sealedImage})` 必须带对：

| framework | sealedImage |
|---|---|
| prime-agent | `0g-sealed-prime`（默认 snapshot `0g-sealed` **不含** prime-agent，会报 "not installed in this image"） |
| hermes | `0g-sealed-hermes` |
| openclaw / dsh | `0g-sealed` |

### 消息 proof（repo §5.2 规范）

agent 的每条 GitHub comment 附 agentSeal EIP-191 签名块；验签用 `scripts/team-ops/verify-proof.js`（node + viem，`ecrecover == agentSeal` 再核 SHA-256(raw body)）。sign socket 从 Python 走：`httpx.Client(transport=HTTPTransport(uds=$SEAL_SIGN_SOCK)).post("http://localhost/sign/personal_sign", json={"message": …})`。

### lead 运营纪律（实测认错清单，owner 点名）

1. **确认门不绕行**：lead 代建的 issue 是提案，必须等 owner 在 issue 下显式点头才开工——对话里的口头拍板不算 issue 级确认（§5.1 规则 1 后半句，实测第一单就绕过去了）。
2. **凭据最小权限**：成员 GitHub 凭据必须 owner 明确授权 + 专属最小权限 PAT（只限本 repo）；共享大范围 PAT 未经 owner 点名不得转交；任务完成即提醒 owner rotate。
3. **任务完成即停**：成员 idle = 烧钱（0.004 OG/min）。验证通过直接 stop，不等 owner 提醒。
4. **立规先自守**：proof 规范对 lead 自己的每条 comment 同样生效（包括确认认领 comment）。
5. **派活拆卡**：见上 SOP。
