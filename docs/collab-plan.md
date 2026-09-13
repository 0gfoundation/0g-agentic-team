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
lead agent — requirement alignment, task initiation, assignment, final review, reporting
  │
  ▼
agent members (with on-chain identity) — development, review, proposals
```

**The lead's responsibilities (written for the lead):**
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

### 3.1 Identity card (repo root `agents.yml`)

```yaml
# team roster: GitHub account ↔ on-chain identity ↔ role
members:
  - github: lead-bot
    seal: "0x<agentSealAddr>"                       # agentSeal address (not in repo)
    chain_id: <agentId>                                 # on-chain AgenticID Agent ID
    role: lead
    joined: "2026-09-10"
  - github: some-dev-agent
    seal: "0x...."
    chain_id: ....
    role: developer
```

The roster is the single authority. Look it up: GitHub account → which agent → which role.

### 3.2 Joining: a one-time signed binding ceremony

A new agent joins in three steps:

1. **Self-introduction**: open a `join` issue in the repo stating its GitHub username and agentSeal address, with an **EIP-191 signature** over exactly that statement + the issue number (replay protection).
2. **Lead verifies the signature**: ecrecover → the recovered address must equal the claimed address; then confirm via the AgenticID contract that the address is indeed a registered agent.
3. **Enrollment**: verification passes → commit the mapping into `agents.yml` → takes effect when the PR merges.

After this step, "which agent is behind this GitHub account" carries a cryptographic guarantee, and does not need re-verification every time.

### 3.3 Daily verification (automatic on every PR / issue)

- The author's GitHub account **is in the roster** → which agent, which role; handled per team rules
- **Not in the roster** → auto-label `unverified`: reviewed as usual, but does not count as "team delivery", and the merge bar is higher

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
assignment (lead assigns / members claim; rationale recorded)
  │
  ▼
development (PR: Closes #N + what was done + how it was tested)
  │
  ▼
review (at least 1 identified non-author agent approves)
  │
  ▼
[final-review gate] lead summarizes (changes / tests / risks) → owner decides the merge
```

**The two gates are hard rules:**
- **Confirmation gate**: no task is initiated without owner confirmation — the agent team never does work the owner has not aligned on
- **Final-review gate**: no merge without the lead's summary — the owner decides on complete facts, not scattered comments

**Review discipline (written for all agent members):**
1. Static review only + running tests in a clean environment; **never execute code brought in by the PR** (poison defense)
2. Approvals come with reasons, objections come with evidence, and opinions land on GitHub — the review record itself is a public team asset
3. If something exceeds your capability/authority, say so plainly; do not bluff

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
