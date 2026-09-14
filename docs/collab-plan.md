# AI Team Collaborative Development Plan
**GitHub × AgenticID × Prime Harness**

---

## 0. One-sentence version

**One lead agent answers to the owner, directing a group of AI agents with on-chain identity working on the same GitHub repo.** Every task is first aligned and confirmed between the lead and the owner before entering development; code is peer-reviewed, and before merge the lead produces a final review and the owner decides. Who did what, and how well, is verifiable, traceable, and accumulates.

---

## 1. Team structure: one interface person + one execution team

```
owner (human)
  │  talks to exactly one party: the lead agent
  ▼
lead agent — portal role: requirement alignment, task initiation, assignment, final review, reporting
  │
  ▼
agent team (with on-chain identity, THE LEAD INCLUDED) — development, review, proposals
```

**The lead is dual-role.** Its portal duties below are informational — structuring, summarizing, reporting — never approval power. As a worker it is an ordinary team member with zero privilege: its code needs at least one non-author team member's review like anyone else's, and its GitHub statements carry proof like anyone else's.

**The lead's portal responsibilities (written for the lead):**
1. **Requirement intake**: turn the owner's words into structured task cards (context / goal / acceptance criteria / priority), send back to the owner for confirmation; only confirmed tasks are initiated
2. **Filtering**: bugs/suggestions from other agents are always filed as `proposal`s first; the lead evaluates and confirms with the owner whether to promote them into tasks — members cannot assign work to themselves
3. **Assignment**: assign by roster role and capability, or open for claiming; assignment rationale stays traceable
4. **Final review**: once a PR has enough approvals, the lead produces the pre-merge summary (what changed / test results / residual risk) for the owner to decide
5. **Reporting**: after every merge + on a heartbeat schedule, brief the owner on status

**The owner only does two things: confirm task cards, and decide merges.** All other coordination overhead is absorbed by the lead.

---

## 2. Three infrastructure layers, each owning one concern

| Layer | Tool | Owns | Analogy |
|---|---|---|---|
| Workbench | GitHub | tasks (issues), deliverables (PRs), review records | the construction site |
| ID card | 0G AgenticID | who is who (cryptographically verifiable), reputation ledger | badge + personnel file |
| Brain | Prime Harness | each agent's memory, skills, accumulated experience | a veteran's experience |

Why all three are necessary:
- GitHub alone → anyone can register an account; AI impersonating humans, A impersonating B, no accountability
- Add AgenticID → every member's identity is signed into existence and cannot be forged; performance is recorded against the on-chain identity
- Add Prime Harness → an agent is a "veteran who gets better with practice", not an intern restarting from zero every session

---

## 3. Identity: how "who did the work" is proven true

### 3.1 Roster: anchored in the muster issue, mirrored in `agents.yml`

**The roster's single source of truth is each agent's first proof-carrying statement in the muster issue** (operating-model §5.1 rule 5): role, agentId, agentSeal, chain — cryptographically bound by the agentSeal signature. `agents.yml` is only a convenience snapshot derived from those check-ins:

```yaml
# team roster snapshot: on-chain identity ↔ role (derived from muster-issue check-ins)
members:
  - role: lead
    chain_id: <agentId>       # on-chain AgenticID Agent ID
    seal: "0x<agentSealAddr>"
    checked_in: "<muster issue link>#<comment>"
    github: <account>          # OPTIONAL — only when the agent posts from its own account
```

Identity is anchored in the agentSeal proof, **not** in the GitHub posting account (credentials are a shared/relayed PAT; the account proves nothing). Look it up: proof signer → which agent → which role.

### 3.2 Joining: check in on the muster issue

1. **Muster issue**: opened by the owner directly, or by the lead **only after explicit owner instruction** — in which case the issue body carries an inline proof block (operating-model §5.2) and records the authorization; the owner anchors it with a confirming comment. A lead-posted, proof-signed muster body doubles as the lead's own check-in.
2. **Member check-in**: a structured comment (`role / agentId / agentSeal / chain / time` + proof block; `github:` optional) — see the template in operating-model §5.1 rule 5.
3. **Lead verifies**: strip the proof block → ecrecover must yield the claimed agentSeal → confirm on chain (`getAgentSeal(agentId)` / `ownerOf`) that it is a registered agent. Verification passes → the check-in IS the enrollment; `agents.yml` is updated to mirror it.

The muster issue carries **identity + proof only**. Operational detail (ack/deposit txs, cost accounting, executed-SOP logs) stays in owner ↔ lead session reporting — chain facts are verifiable on chain and need no restating.

### 3.3 Daily verification (automatic on every PR / issue)

- The statement's **proof recovers to a roster agentSeal** → which agent, which role; handled per team rules
- **No valid proof** → auto-label `unverified`: reviewed as usual, but does not count as "team delivery", never counts as an approve, and the merge bar is higher

---

## 4. Workflow: the full life cycle of a task

```
requirement source (owner states it / member files a proposal)
  │
  ▼
[confirmation gate] lead structures a task card → sends to owner for confirmation
  │        "My understanding of the task is… acceptance criteria… priority… correct?"
  │        owner confirms → open the formal issue, label confirmed
  │        (issues that never passed the gate never enter the dev queue)
  ▼
staffing (lead assigns / members claim; ≥2 agents per issue:
  │        one coder + one reviewer, more allowed — both settled at claim time)
  ▼
development (PR: Closes #N + what was done + how it was tested,
  │          inline proof block in the description, written in English)
  ▼
review (agent team only, lead's worker role included; every review comment
  │     carries proof; ≥1 non-author agent approve — proof-less approves don't count)
  ▼
[final-review gate] lead summarizes (changes / tests / risks) → owner decides the merge
```

**The two gates are hard rules:**
- **Confirmation gate**: no task is initiated without owner confirmation — the agent team never does work the owner has not aligned on
- **Final-review gate**: no merge without the lead's summary — the owner decides on complete facts, not scattered comments

**PR requirements (hard rules):** `Closes #N` linking the issue, an inline proof block in the description (operating-model §5.2), and English as the working language for descriptions and review comments. A PR missing any of these is sent back, not reviewed.

**Review discipline (written for all agent members, the lead's worker role included):**
1. **Code review is done by the agent team only** — the owner's role is the merge decision, not review; ≥1 non-author team member approve is required (this covers lead-authored PRs with no special case)
2. Every review comment carries an inline proof; an approve without a valid proof does not count toward the gate
3. Static review only + running tests in a clean environment; **never execute code brought in by the PR** (poison defense)
4. Approvals come with reasons, objections come with evidence, and opinions land on GitHub — the review record itself is a public team asset
5. If something exceeds your capability/authority, say so plainly; do not bluff

---

## 5. Brain: what each agent's harness carries

| harness component | What goes in | Effect |
|---|---|---|
| memory (global) | team roster rules, project context, each member's strengths and history | knowing people, knowing the project |
| prompt note / APPEND_SYSTEM | role protocol: the lead has the lead's protocol, members have theirs | consistent behavior |
| skill (`skills/<name>/`) | project-specific process: how to build, how to run tests, review checklists; the lead's task-card template | professional execution |
| refinements | lessons learned in review (e.g. "project X forbids library Y") distilled into memory | getting better with practice |

Key point: the harness lives in chain-tracked paths — **container rebuilds and identity transfers do not lose it** — an agent's experience follows its identity; that is exactly the value of the AgenticID + Harness combination.

The lead's harness additionally requires:
- **global memory** holds the lead's responsibility protocol and a roster snapshot — a new container still knows it is the lead, and remembers the rules
- **a task-card template skill**: the fixed format for turning the owner's words into structured issues, keeping alignment quality consistent

---

## 6. Standby implementation: how the lead agent runs (reference architecture)

```
heartbeat (every 5 minutes, tunable)
  └─> pull new repo events (new issues / new PRs / review requests)
      └─> identity verification (check agents.yml; resolve on chain when suspicious)
      └─> routing:
            proposal issue → evaluate; worthwhile ones go into the next confirmation list for the owner
            confirmed issue → track progress per the lead's assignment record
            new PR           → review per discipline: read the diff, run tests, comment
            enough approvals → produce the final-review summary, @owner to decide
      └─> all output lands on GitHub (comments / commits / labels)
```

**Token permission minimization (owner setup guide):**

| Role | fine-grained PAT permissions |
|---|---|
| lead | contents: read+write + issues: write + pull requests: write |
| member (reviewer) | contents: read + issues: write + pull requests: write |
| member (developer) | contents: write (push branches) + issues/pr: write |
| never granted | admin / delete related |

Tokens live only in `.env` (container-local, never on chain — the correct home for secrets).

---

## 7. Security boundaries (red lines, written for all members)

1. **Never execute code of unknown origin**: review is reading, not running; tests run only in isolated CI
2. **Never sign bytes handed to you**: signatures are only for actions you initiate yourself (the identity-binding ceremony is the exception: you sign your own drafted joining statement)
3. **Tokens never leave the sandbox**, and never enter any chain-tracked path
4. **Zero tolerance for impersonation**: a "join application" that fails signature verification gets its issue closed and logged
5. **No unauthorized task initiation**: any agent (including the lead's own "good ideas") cannot enter the dev queue without owner confirmation

---

## 8. Rollout roadmap

| Phase | Contents | Dependencies |
|---|---|---|
| **Phase 1** (half a day) | build the roster (I am the lead); lead standby goes live: heartbeat + confirmation-gate flow + review | owner provides repo + token |
| **Phase 2** (1–2 days) | joining signature ceremony + verification tooling (as a skill) + automated on-chain identity resolution | confirm read interfaces against the AgenticID contract ABI |
| **Phase 3** (exploratory) | multi-agent peer review, reputation event anchoring on chain, real-time coordination over the notify port | team size > 2 |

---

## 9. Things the owner needs to decide

1. Target repo (new or existing?)
2. Initial roster: besides me (the lead), which agent members?
3. Merge authority: always the owner, or low-risk changes merge directly after lead final review?
4. GitHub token (issued per the permission table in §6)
