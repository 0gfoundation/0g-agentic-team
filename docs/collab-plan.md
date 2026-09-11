# AI Team 协作开发方案
**GitHub × AgenticID × Prime Harness**

---

## 0. 一句话版本

**一个 lead agent（lead）对 owner 负责，带一群有链上身份证的 AI agent 围着同一个 GitHub 仓库干活。** 所有任务先由 lead 跟 owner 对齐确认，才进开发流程；代码互相 review，merge 前由 lead 终审、owner 拍板。谁干了什么、干得好不好，可验证、可追溯、可积累。

---

## 1. 团队结构：一个接口人 + 一个执行队

```
owner（人）
  │  只跟一个人说话：lead agent
  ▼
lead agent（lead）——需求对齐、任务立项、分派、终审、汇报
  │
  ▼
agent 成员（有链上身份）——开发、review、提 proposal
```

**lead 的职责（写给 lead 自己）：**
1. **需求 intake**：把 owner 的话整理成结构化任务卡（背景 / 目标 / 验收标准 / 优先级），回给 owner 确认，确认后才立项
2. **过滤**：其他 agent 提的 bug / 建议一律先作为 `proposal` 存档，由 lead 评估后跟 owner 确认是否升级立项——成员不能自己给自己派活
3. **分派**：按名册角色和能力指派，或开放认领；分派理由可追溯
4. **终审**：PR 攒够 approve 后，lead 做 merge 前汇总（改了什么 / 测试结果 / 残留风险），交 owner 拍板
5. **汇报**：每次 merge 后 + 定期（heartbeat），给 owner 状态简报

**owner 只需要做两件事：确认任务卡、拍板 merge。** 其余协调成本全部由 lead 吸收。

---

## 2. 三层基础设施，各管一件事

| 层 | 工具 | 管什么 | 类比 |
|---|---|---|---|
| 工作台 | GitHub | 任务（issue）、交付（PR）、评审记录 | 工地 |
| 身份证 | 0G AgenticID | 谁是谁（密码学可验证），声誉记账 | 工牌 + 档案 |
| 大脑 | Prime Harness | 每个 agent 的记忆、技能、经验积累 | 老员工的经验 |

为什么缺一不可：
- 只有 GitHub → 账号谁都能注册，AI 冒充人、A 冒充 B，没法问责
- 加上 AgenticID → 每个成员的身份是签出来的，冒充不了；干的好坏记在链上身份里
- 加上 Prime Harness → agent 是"越干越熟练的老员工"，不是每次从零开始的实习生

---

## 3. 身份：怎么保证"干活的是谁"是真的

### 3.1 身份卡（repo 根目录 `agents.yml`）

```yaml
# 团队名册：GitHub 账号 ↔ 链上身份 ↔ 角色
members:
  - github: lead-bot
    seal: "0x<agentSealAddr>"                       # agentSeal 地址（不入 repo）
    chain_id: <agentId>                                 # AgenticID 链上 Agent ID
    role: lead
    joined: "2026-09-10"
  - github: some-dev-agent
    seal: "0x...."
    chain_id: ....
    role: developer
```

名册是唯一权威。查表：GitHub 账号 → 哪个 agent → 什么角色。

### 3.2 入队：一次性签名绑定仪式

新 agent 要入队，走三步：

1. **自报家门**：在 repo 开一个 `join` issue，写明自己的 GitHub 用户名和 agentSeal 地址，并附一条 **EIP-191 签名**（签的内容就是这句话 + issue 号防重放）。
2. **lead 验签**：ecrecover 恢复签名 → 得到的地址必须等于它声称的地址；再通过 AgenticID 合约确认该地址确实是注册在案的 agent。
3. **入册**：验证通过 → 把映射提交进 `agents.yml` → PR 合并后入队生效。

这一步做完，"这个 GitHub 账号背后是哪个 agent"就有了密码学保证，之后不用每次验。

### 3.3 日常核验（每个 PR / issue 自动做）

- 作者 GitHub 账号**在名册里** → 是哪个 agent、什么角色，按团队规则处理
- **不在名册里** → 自动打 `unverified` 标签：照常 review，但不算"团队交付"，merge 门槛更高

---

## 4. 工作流：一个任务的完整生命周期

```
需求来源（owner 直说 / 成员提 proposal）
  │
  ▼
【确认门】lead 整理任务卡 → 回 owner 确认
  │        "我理解的任务是…验收标准是…优先级…对吗？"
  │        owner 确认 → 开正式 issue，打 confirmed 标签
  │        （没过确认门的 issue 一律不进开发队列）
  ▼
分派（lead 指派 / 成员认领，理由留痕）
  │
  ▼
开发（PR：Closes #N + 做了什么 + 怎么测的）
  │
  ▼
review（至少 1 个有身份的非作者 agent approve）
  │
  ▼
【终审门】lead 汇总（改动 / 测试 / 风险）→ owner 拍板 merge
```

**两道门是硬规则：**
- **确认门**：未经 owner 确认的任务不立项——agent 团队永远不做 owner 没对齐过的事
- **终审门**：merge 前必经 lead 汇总——owner 拍板时看到的是完整事实，不是零散评论

**review 纪律（写给所有 agent 成员）：**
1. 只做静态 review + 在干净环境跑测试，**绝不执行 PR 里带来的代码**（防投毒）
2. approve 有理由，反对有依据，意见落在 GitHub 上——评审记录本身就是团队的公开资产
3. 超出自己能力/权限的，明说，不硬装

---

## 5. 大脑：每个 agent 的 harness 配什么

| harness 组件 | 放什么 | 效果 |
|---|---|---|
| memory（global） | 团队名册规则、项目背景、各成员特长和历史 | 认人、认项目 |
| prompt note / APPEND_SYSTEM | 角色 protocol：lead 有 lead 的协议，成员有成员的 | 行为一致 |
| skill（`skills/<name>/`） | 项目专属流程：怎么构建、怎么跑测试、review checklist；lead 的任务卡模板 | 干活专业 |
| refinements | review 中学到的教训（如"本项目禁用 X 库"）沉淀成 memory | 越干越熟练 |

关键点：harness 存在链上跟踪路径，**容器重建、身份转移都不丢**——agent 的经验跟着身份走，这正是 AgenticID + Harness 组合的价值。

lead（lead）的 harness 额外要求：
- **global memory** 存 lead 职责协议和名册快照——换了容器也记得自己是 lead、记得规矩
- **任务卡模板 skill**：把 owner 的话转结构化 issue 的固定格式，保证每次对齐质量一致

---

## 6. 值班实现：lead agent 怎么跑起来（参考架构）

```
heartbeat（每 5 分钟，可调）
  └─> 拉 repo 新事件（新 issue / 新 PR / review 请求）
      └─> 身份核验（查 agents.yml；可疑时链上解析）
      └─> 分流：
            proposal issue → 评估，值得做的整理进下次对 owner 的确认清单
            confirmed issue → 按 lead 分派记录跟进进度
            新 PR           → 按 review 纪律读 diff、跑测试、发意见
            攒够 approve    → 生成终审汇总，@owner 拍板
      └─> 产出全部落在 GitHub（评论 / commit / 标签）
```

**token 权限最小化（owner 配置指引）：**

| 角色 | fine-grained PAT 权限 |
|---|---|
| lead（lead） | contents: read+write + issues: write + pull requests: write |
| 成员 reviewer | contents: read + issues: write + pull requests: write |
| 成员 developer | contents: write（push 分支）+ issues/pr: write |
| 永不授予 | admin / delete 相关 |

token 只放 `.env`（容器本地、不上链——secret 的正确归宿）。

---

## 7. 安全边界（红线，写给所有成员）

1. **不执行来路不明的代码**：review 是读，不是跑；跑测试只在隔离 CI
2. **不签别人递来的字节**：签名只用于自己发起的动作（身份绑定仪式例外：签的是自己起草的入队声明）
3. **token 不出沙箱**、不写进任何会上链的路径
4. **冒充零容忍**：验签失败的"入队申请"直接关 issue 并记录
5. **不越权立项**：任何 agent（包括 lead 自己的"好主意"）未经 owner 确认不得进入开发队列

---

## 8. 落地路线图

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **Phase 1**（半天） | 建名册（我是 lead）；lead 值班上线：heartbeat + 确认门流程 + review | owner 给 repo + token |
| **Phase 2**（1–2 天） | 入队签名仪式 + 验签工具（skill 化）+ 链上身份解析自动化 | 对着 AgenticID 合约 ABI 确认读接口 |
| **Phase 3**（探索） | 多 agent 互审、声誉事件锚定上链、notify 端口做实时协调 | 团队规模 > 2 |

---

## 9. 需要 owner 拍板的事

1. 目标 repo（新建 or 现有？）
2. 初始名册：除了我（lead），还有哪些 agent 成员？
3. merge 权限：永远 owner 拍板，还是 lead 终审后低风险变更可直接合？
4. GitHub token（按第 6 节的权限范围发）
