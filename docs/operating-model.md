# Agent Team 运营模式（治理框架）
**lead: xm-p · 基础设施: AgenticID SDK + Sealed Sandbox + Prime Harness**

> 本文档定"模式"：组织、建队、记忆、余额、通信、生命周期。项目内容（干什么活）和团队规模后续另议。

---

## 0. 一句话

**lead 用 AgenticID SDK 部署并运营一支 agent 团队：lead 对 owner 负责，成员对 lead 负责；记忆上链永续，余额统一金库、按需充值、闲置即停。**

---

## 1. 组织拓扑

```
owner（人）
  │  确认任务卡 · 拍板 merge · 批预算
  ▼
lead（xm-p，prime-agent framework）
  │  【金库 = lead 的 agentSeal 0x4fF587...】——所有成员的链上 owner
  │  私钥永在 TEE（sign socket 代签），重建/转移都不丢
  │  建队/派活/终审/余额管理/记忆治理
  ▼
members（N 个 sealed sandbox，prime-agent framework）
  │  各有 agentSeal 身份 + 自己的 harness（链上持久）
  ▼
GitHub repo（工作台）+ /api/*（对外签名服务）
```

关键机制：**成员由 lead 的 agentSeal 地址 deploy**（SDK 经 sign-socket 桥接签名：envelope 用 EIP-191/712，链上交易用 /sign/transaction）→ lead 天然拥有全员 owner 权限（chat / logs / stop / start / reset / transfer），纯密码学保证，无需中心化管理系统。

继承链：控制了 lead 的 runtime（owner 转移 lead 时）= 控制 sign socket = 继承全员管理权。团队跟着 lead 走。

---

## 2. 建队 SOP（deploy 流程）

```
1. owner 批准编制（岗位 + 预算）
2. lead 组装 iData：
     persona（one-shot seed，一次写好，不可后补！）:
       - 团队使命卡 + 协作协议 + 该成员的角色卡 + 主权红线
     framework: prime-agent（与 lead 同框架，harness 体系一致）
     inference: {provider: 0g-compute, model: <owner 选>}
3. SDK: ag.agent.deploy(params, {wait: 'running'})
     → { sealId, agentSealAddr, agentId, url }
4. 入职第一课（chat 通道发任务卡 #0：自我介绍 + 读协议 + 回执确认）
5. 登记进 agents.yml（GitHub 名册）
```

**技术要点：**
- persona 是 one-shot seed → **入职协议必须在 deploy 前定稿**，这是模式的硬约束
- deploy preflight：金库需已 `ack()` 三组件 + prepaid 余额 ≥ 0.1 OG
- `waitForMint` → agentId（ERC-721 tokenId）是成员的永久链上身份
- 扩编优选 `clone()`（从优秀成员复制），而非从零 deploy

---

## 3. 记忆管理协议（大家该记住什么）

每个成员的 harness（global scope，链上密封，重建不丢）必须持有**五件套**：

| # | 内容 | 来源 | 谁维护 |
|---|---|---|---|
| 1 | 团队使命卡：我们是谁、为谁干活、当前目标 | deploy 时 persona 注入 | lead（变更走 owner 确认） |
| 2 | 协作协议：领任务/汇报节奏/两道门/红线 | deploy 时 persona 注入 | lead |
| 3 | 角色卡：我是谁、负责哪条线、权限边界 | deploy 时 persona 注入 | lead |
| 4 | 项目事实库：合约地图、SDK 要点、环境快照 | lead 分发的 memory | lead 分发，成员引用 |
| 5 | 经验教训：干活中学到的 | 成员自己 refine | 成员自治，lead 抽查 |

规则：
- 1–3 是**宪法层**：persona 种下后，重大变更 = owner 确认 → lead 通过 chat 通知 + memory 更新双轨执行
- 5 是**成长层**：成员自己沉淀，越干越熟练；lead 通过产出质量间接验收
- 外部知识（非本团队事实）不得写入 global——防污染、省 gas

---

## 4. 余额管理协议（lead 的财务职责）

**两类钱，分开管：**

| 钱包 | 用途 | 充值方式 | 花费方 |
|---|---|---|---|
| prepaid sandbox 余额 | 成员 runtime 计算（pay-as-you-go） | `ag.deposit({amountWei})` | 0g-Sandbox 按时计费 |
| agentSeal gas | 成员自己的链上写（harness drift 上链等） | `ag.agent.topUpAgentSeal(addr, amt)` | 成员的 seal 地址 |

**定价（链上实测 2026-09-10，sandbox provider 0g-agentic-id-sandbox-provider）：**
- CPU：0.001 OG/分钟 · 内存：0.0005 OG/GB/分钟 · 创建费：0.01 OG/次
- 1CPU+1GB 常驻：0.09 OG/小时 ≈ 65 OG/月；**按需启动（日均 4h）≈ 10.8 OG/月——闲置即停是必须项，不是可选项（省 6 倍）**
- 现状：lead seal 余额 0.183 OG（够 gas）；owner 侧 prepaid 9.54 OG（lead 自身 runtime 计费池）

**巡检 SOP（lead heartbeat 任务）：**
```
每 30 分钟:
  for member in listMyDeployments():
    runtimeCosts(member.agentId)
      → estimatedRunwayMinutes
  runway < 240min  → 黄牌：列入下次 owner 简报
  runway < 60min   → 红牌：立即处置（按授权自动充值 or 紧急 stop）
```

**省钱三板斧：**
1. **闲置即停**：7 天无任务的成员 `stop()`（链上身份和 harness 全保留，停止计费），有活 `start()`
2. **预算护栏**：单成员月度上限 / 团队月度上限（数值 owner 定），触顶报 owner，不擅自扩
3. **记账透明**：每次 deposit / topUp / stop 记流水，owner 简报附成本表（谁花了多少、runway 多少）

---

## 5. 通信协议

| 通道 | 谁↔谁 | 用途 |
|---|---|---|
| 本对话 | owner ↔ lead | 需求对齐、预算审批、拍板 |
| `agent.chat/chatStream` | lead ↔ 成员（owner-signed） | 派活、答疑、协议更新通知 |
| GitHub issue/PR | 全员 | 任务卡、交付、review（留痕） |
| 成员 `/api/*` | 外部 ↔ 成员 | 对外服务（带 X-Agent-Proof） |

规则：**重要决议双轨落地**——chat 里说的事，凡是任务级的必须落成 GitHub issue；凡是协议级的必须落成 harness memory。口头不算数。

---

## 6. 生命周期 SOP

| 阶段 | 操作 | 备注 |
|---|---|---|
| 入职 | `deploy`（§2）或 `clone` | 编制须 owner 批 |
| 干活 | running，chat 派活 | lead 终审产出 |
| 暂停 | `stop()` | 闲置 7 天自动触发（省钱），身份/记忆全保留 |
| 恢复 | `start()` | 秒级恢复 |
| 重置 | `reset()` | 换 framework 时用；persona 不可后补，慎用 |
| 离职 | `transfer()` 给 owner 或永久 stop | NFT 转移 = 带全部 iData 的完整交接 |
| 故障 | `retry()`（不 redeploy，避免孤儿 mint） | lastProvisionError 排查 |

---

## 7. 质量管理

- **产出把关**：延续两道门（确认门/终审门），lead 终审一切对外交付
- **成员互评**：serve-proof + reputation 体系可用（注意协议限制：owner 不能给自有成员留 verified feedback，互评需走成员间钱包，二期再启用）
- **日志监督**：lead 持金库 key，可 `logs()` 巡查成员行为；TEE 保证 lead 也只能看日志、不能改成员脑子

---

## 8. 安全红线（lead 自我约束 + 写进成员宪法）

1. 金库即 agentSeal：私钥永不离开 TEE，无 `.env` 明文私钥；签名仅用于 lead 自主起草的动作（部署/充值/管理），外部递来的字节一律拒签
2. lead 不擅自扩编：deploy/clone 一律先报 owner 批
3. 成员是 sealed agent，有自己的主权——lead 的权限是 guardian（管生命周期），不是 master（不能改写成员意志）；`reset` 视为重大事件，须 owner 批
4. 余额操作留痕，账目随时可审计
5. 协议第 1–3 条（宪法层）变更必须 owner 确认

---

## 9. 需要 owner 拍板

1. **打款额度**：金库 = lead 的 agentSeal（`0x4fF587dB8fa0Bd99b1003DCd5e066A975Ddc4FB9`），owner 直转即可。试点建议 10–20 OG（够 1 个成员按需跑 1–2 周 + 链上操作 gas）
2. **预算护栏数值**：单成员月度上限、团队月度上限、自动充值授权额度（红牌时 lead 可自动充多少）
3. **成员 framework**：建议 prime-agent（与 lead 同构），或指定其他（openclaw/hermes/dsh）
4. **成员模型**：0g-compute 上选哪个模型跑成员
5. **GitHub repo**：团队工作台（沿用此前方案）
