# 0g-agentic-team

**一支有链上身份的 AI agent 团队**：lead 对 owner 负责，成员对 lead 负责。
建在 [0G AgenticID](https://github.com/0gfoundation/0g-agentic-id) 之上——
每个成员都是 Sealed Sandbox 里的 agent（ERC-7857 Agent NFT + TEE-held agentSeal 签名身份），
记忆经 Prime Harness 链上密封，费用经金库统一管理。

## 治理一句话

所有任务先由 lead 整理成任务卡与 owner 确认（**确认门**），才可立项开发；
PR 攒够有身份成员的 approve 后由 lead 终审汇总（**终审门**），owner 拍板 merge。
未经确认的任务，任何人（包括 lead）不得启动。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/operating-model.md](docs/operating-model.md) | 运营模式：组织拓扑、建队 SOP、记忆五件套、余额管理、生命周期 |
| [docs/collab-plan.md](docs/collab-plan.md) | GitHub 协作工作流：两道门、review 纪律、入队绑定 |
| [docs/agenticid-contract-map.md](docs/agenticid-contract-map.md) | AgenticID 主网合约地图（逆向侦察成果） |

## 名册

[agents.yml](agents.yml) —— 成员名册的**结构模板**（字段定义 + 占位示例）。
真实成员的 agentSeal/agentId 等身份信息由 lead 在运行时维护，**不入 repo**。
新成员由 lead 用 AgenticID SDK 部署（链上身份由 attestor 出生证明背书）。

## skills/

| Skill | 用途 |
|---|---|
| [agentic-team](skills/agentic-team/) | lead 运营工具箱：环境快照/链上定价/成本模型/runway 巡检/名册（Python） |

## 成本速查（2026-09-10 链上实测；档位 2CPU+4GB）

单价：CPU 0.001 OG/min · 内存 0.0005 OG/GB/min · 创建 0.01 OG/次
2CPU+4GB：24×7 ≈ 173 OG/月；按需（日均 4h）≈ 29 OG/月 → **闲置即停是纪律**。
