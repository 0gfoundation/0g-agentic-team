# Agent Team Operating Model (governance framework)
**lead: lead · infrastructure: AgenticID SDK + Sealed Sandbox + Prime Harness**

> This document defines the *model*: organization, team building, memory, balances, communication, lifecycle. Project content (what work to do) and team size are decided separately.

---

## 0. One sentence

**The lead deploys and operates a team of agents with the AgenticID SDK: the lead answers to the owner, members answer to the lead; memory persists on chain, balances run through a shared treasury, topped up on demand, stopped when idle.**

---

## 1. Organization topology

```
owner (human)
  │  confirms task cards · decides merges · approves budgets
  ▼
lead (lead, prime-agent framework)
  │  [treasury = the lead's agentSeal] — the on-chain owner of all members
  │  (address provided at runtime by env AGENT_SEAL, never in the repo)
  │  private key never leaves the TEE (signed via the sign socket); survives rebuild/transfer
  │  team building / assignment / final review / balance management / memory governance
  ▼
members (N sealed sandboxes, prime-agent framework)
  │  each with an agentSeal identity + its own harness (chain-persistent)
  ▼
GitHub repo (workbench) + /api/* (externally signed services)
```

Key mechanism: **members are deployed from the lead's agentSeal address** (the SDK signs through the sign-socket bridge: envelopes via EIP-191/712, chain transactions via /sign/transaction) → the lead naturally holds owner authority over every member (chat / logs / stop / start / reset / transfer), a purely cryptographic guarantee with no centralized management system.

Chain of inheritance: controlling the lead's runtime (when the owner transfers the lead) = controlling the sign socket = inheriting management of the whole team. The team follows the lead.

---

## 2. Team-building SOP (deploy flow)

```
1. owner approves headcount (roles + budget)
2. lead assembles iData:
     persona (one-shot seed, written once, cannot be amended later!):
       - team mission card + collaboration protocol + the member's role card + sovereignty red lines
     framework: prime-agent (same framework as the lead, consistent harness system)
     inference: {provider: 0g-compute, model: <owner's choice>}
3. SDK: ag.agent.deploy(params, {wait: 'running'})
     → { sealId, agentSealAddr, agentId, url }
4. first lesson on joining (send task card #0 over the chat channel: self-intro + read the protocol + reply confirmation)
5. register into agents.yml (GitHub roster)
```

**Technical points:**
- the persona is a one-shot seed → **the onboarding protocol must be finalized before deploy**; this is a hard constraint of the model
  - template and deploy checklist: [onboarding-persona.md](onboarding-persona.md) (fill in → lead final review → owner confirmation → deploy)
- deploy preflight: the treasury must have `ack()`ed the three components + prepaid balance ≥ 0.1 OG
- `waitForMint` → agentId (the ERC-7857 Agent NFT tokenId) is the member's permanent on-chain identity
- scaling up prefers `clone()` (copying from an excellent member) over deploying from scratch

---

## 3. Memory management protocol (what everyone must remember)

Every member's harness (global scope, sealed on chain, survives rebuilds) must hold **the five components**:

| # | Content | Source | Maintained by |
|---|---|---|---|
| 1 | Team mission card: who we are, who we work for, current goals | injected at deploy via persona | lead (changes require owner confirmation) |
| 2 | Collaboration protocol: taking tasks / reporting cadence / the two gates / red lines | injected at deploy via persona | lead |
| 3 | Role card: who I am, which line I own, authority boundaries | injected at deploy via persona | lead |
| 4 | Project fact base: contract map, SDK essentials, environment snapshots | memory distributed by the lead | lead distributes, members cite |
| 5 | Lessons learned: distilled from the work | members refine themselves | member-autonomous, lead spot-checks |

Rules:
- 1–3 are the **constitutional layer**: once seeded via persona, major changes = owner confirmation → lead executes via chat notification + memory update, dual-track
- 5 is the **growth layer**: members distill their own; the lead indirectly accepts via output quality
- external knowledge (non-team facts) must not be written into global — pollution prevention, gas savings

---

## 4. Balance management protocol (the lead's financial duty)

**Two kinds of money, managed separately:**

| Wallet | Purpose | Top-up method | Spender |
|---|---|---|---|
| prepaid sandbox balance | member runtime compute (pay-as-you-go) | `ag.deposit({amountWei})` | 0g-Sandbox time-based billing |
| agentSeal gas | members' own on-chain writes (harness drift anchoring etc.) | `ag.agent.topUpAgentSeal(addr, amt)` | the member's seal address |

**Pricing (measured on chain 2026-09-10, sandbox provider 0g-agentic-id-sandbox-provider):**
- CPU: 0.001 OG/min · memory: 0.0005 OG/GB/min · creation fee: 0.01 OG/instance
- standard tier 2CPU+4GB: 0.24 OG/hour; 24×7 always-on ≈ 173 OG/month; **on-demand (4h/day average) ≈ 29 OG/month — idle-stop is mandatory, not optional (a 6× saving)**
- current state: lead seal balance 0.183 OG (enough for gas); owner-side prepaid 9.54 OG (the billing pool for the lead's own runtime)

**Inspection SOP (lead heartbeat duty):**
```
every 30 minutes:
  for member in listMyDeployments():
    runtimeCosts(member.agentId)
      → estimatedRunwayMinutes
  runway < 240min  → yellow card: into the next owner briefing
  runway < 60min   → red card: act immediately (auto top-up per authorization, or emergency stop)
```

**Three money-saving moves:**
1. **Stop when idle**: members with no task for 7 days get `stop()` (on-chain identity and harness fully retained, billing stops); `start()` when work arrives
2. **Budget guardrails**: per-member monthly cap / team monthly cap (values set by the owner); hitting a cap gets reported to the owner, never silently exceeded
3. **Transparent ledger**: every deposit / topUp / stop is recorded; owner briefings carry a cost table (who spent what, runway of what)

---

## 5. Communication protocol

| Channel | Who ↔ whom | Purpose |
|---|---|---|
| this conversation | owner ↔ lead | requirement alignment, budget approval, decisions |
| `agent.chat/chatStream` | lead ↔ members (owner-signed) | task assignment, Q&A, protocol-update notices |
| GitHub issue/PR | everyone | task cards, deliverables, review (the record) |
| member `/api/*` | outside ↔ members | external services (with X-Agent-Proof) |

Rule: **important decisions land in both places** — anything task-level said in chat must become a GitHub issue; anything protocol-level must become harness memory. Verbal doesn't count.

### 5.1 Issue workflow (a task from initiation to closure)

Issue = task card, PR = deliverable; each gate has a native GitHub landing spot:

1. **Two kinds of issues**: created by the owner = task card (must contain mission + acceptance criteria; the owner creating it personally means the confirmation gate is passed); created by members/lead = proposal or bug report — proposals also pass the confirmation gate: the lead annotates its assessment in the issue, and only ones the owner nods on (comment/emoji) become tasks. Members cannot initiate tasks for themselves.
2. **Claim receipt**: a member's first comment on an issue is the claim receipt (`claim: <role label> @ <time>, expected <deliverable>`), followed by a lead confirmation comment (`lead confirmed claim`) — prevents racing/duplicate work. No work starts before the claim is confirmed.
3. **The owner speaking to a member directly in an issue**: technical facts may be answered directly (honest, brief); task changes and new instructions **don't count** until the lead confirms them into the task card — single-line reporting is not bypassed.
4. **Done ≠ merged**: issues are closed by PR merges (`Closes #N`), never manually — every issue's closure passes through a final-review gate (member approve + lead final review + owner merge decision).
5. **Check-in = joining**: a new member's first act after deploy is a check-in comment on the onboarding issue (with on-chain agentId and role label), simultaneously verifying its GitHub credentials work. The check-in is the joining ceremony.

### 5.2 Agent message proof spec (every agent statement on GitHub carries a signature)

Background: GitHub credentials are a shared PAT — whoever holds it can impersonate any agent. Cryptographic attribution can only come from agentSeal signatures (private keys stay inside each TEE, signing via the sign socket `/sign/personal_sign`).

**Spec (v1.1, sign-on-post)**: every GitHub comment by an agent (lead and members alike) **carries its signature at posting time** — one comment is self-contained, no post-hoc patching:

```
<body>

--- proof ---
signer: <agentSeal address> (agentId <n>)
signature: 0x<…>
```

- **Signature content = the body itself** (everything after stripping the proof block, EIP-191 personal_sign; verified live with CJK content). No message line, no hash, no comment id — you sign exactly what people read; what you see is what you sign.
- **Verification chain** (anyone can do it): strip the proof block from the raw body → `ecrecover(signature, body) == signer` → on-chain `ownerOf(agentId)` attribution check → agentSeal ↔ agentId come from the attestor-issued sealed TEE. Chained together: GitHub statement ← signature ← agentSeal ← on-chain NFT ← TEE. Change one character of the body and the signature breaks.
- **Signing boundary** (sovereignty rule): an agent signs only bodies **it drafted itself** — the signed content is a comment it wrote, not bytes handed from outside. Compliant.
- Human statements (the owner's issues/comments) rest on the GitHub account itself; this spec does not apply.
- Retroactive signing of historical messages (the v1.0 id+SHA-256 declaration method) is only for legacy messages predating this spec; new messages are always signed at posting time.
- PR descriptions and commit messages are encouraged to carry the same-shaped proof (first version covers comments).

**v1.2 additions (2026-09-13, battle-tested by xm-dsh / agentId 3586004; live demo: 0g-agentic-id #153 review 5190679322 + attestation 5653301914)**

**(a) Hash bindings are computed over stored bytes (erratum from live data; hard rule)**
Re-checking a live proof found: the message line of comment `5630896658` claims a `SHA-256(raw body)` that **does not match the GitHub-stored body of target comment `5630552223`** (that comment was never edited; the signature itself is valid, but the hash binding is dead — any verifier recomputing today gets red). Root cause: what was hashed at signing time was the **local draft**, not the bytes GitHub stores. Whenever a proof binds a hash (the v1.0 retroactive form, review attestations, any "SHA-256(xxx)" declaration):
1. **Post first, fetch back, then sign**: after posting, fetch the stored body from the GitHub API, compute the hash over **the fetched bytes**, and only then sign — sign what is stored, not what you drafted;
2. **State the canonical form byte-precisely** ("verbatim, with/without trailing newline", stripped up to byte N) so a verifier can reproduce it exactly; natural language like "raw body" is not enough;
3. **End-to-end self-verify after posting**: re-strip / re-hash / ecrecover from the GitHub-stored bytes; it is not "posted" until it is green — this step has intercepted a real extraction bug; self-verification is an interceptor, not a ritual.
(The v1.1 "sign the body itself" route is naturally immune for comments — no hash, no hash bug; but reviews use the hash-binding route, where this rule is mandatory.)

**(b) Proof for PR reviews: the attestation comment (new form)**
A review is not a comment: the body must keep its formal structure, and the attribution assertion often needs to be decoupled from the posting account (especially under owner-relay). Recommended form (live-tested three times on 0g-agentic-id: #146 / #150 / #153): a **separate attestation comment** whose message binds, in fixed fields, `review_id` + `keccak256(fetched-back review body)` + author identity (agentSeal + agentId + chain) + verification claims (e.g. "every claim in Independently reproduced was re-run in my sandbox"); the proof comment carries viem / foundry verification snippets and the on-chain `getAgentSeal(agentId)` check path. Sign only review bodies and claims you drafted yourself. Tool: `scripts/team-ops/verify-review-proof.js` (added in the same commit; `FETCH=1` recomputes the stored-body hash end to end).

**(c) Signing hygiene (for protocol actions generally: chat envelopes / team APIs / any non-one-shot signature)**
On 2026-09-13 an audit of one self-built team API's SOP found six gaps; after fixing all six plus a smoke regression they distill into general rules:
1. **Freshness**: action signatures carry `time` (ISO-8601 UTC); verifiers enforce a ±10-minute window;
2. **Single-use nonce**: one-time + a **persisted** ledger (an in-memory ledger reopens the replay window on restart); replays are rejected;
3. **Full-payload binding**: sign a canonical digest of the full payload (e.g. `sha256(JSON.stringify([fields…]))`), not a title/label — otherwise severity / detail can be swapped after signing; the server recomputes and rejects mismatches;
4. **Record two facts separately**: `signature_verified` (the signature matches the self-reported address) ≠ `on_chain_registered` (registered on chain) — the audit log records them in separate fields, never merged into one "verified";
5. **No proof, no verification**: unsigned submissions verify nothing and trigger no chain lookups (an anonymous self-reported address does not spend an RPC — which also kills the per-request on-chain DoS vector); record `unverified` + `on_chain_checked: false` explicitly; the field never silently disappears;
6. **Delimiter hygiene**: in pipe-delimited signed messages, free-text fields reject `|` (or escape it).

---

## 6. Lifecycle SOP

| Stage | Operation | Notes |
|---|---|---|
| joining | `deploy` (§2) or `clone` | headcount requires owner approval |
| working | running, task assignment via chat | lead final-reviews all output |
| pause | `stop()` | auto-triggers after 7 idle days (saves money); identity/memory fully retained |
| resume | `start()` | seconds-level recovery |
| reset | `reset()` | use when switching framework; persona cannot be amended afterwards — with care |
| departure | `transfer()` to owner, or permanent stop | NFT transfer = full handover with all iData |
| failure | `retry()` (do not redeploy — avoids orphan mints) | investigate lastProvisionError |

---

## 7. Quality management

- **Output gatekeeping**: the two gates continue (confirmation / final review); the lead final-reviews everything delivered externally
- **Member peer review**: the serve-proof + reputation system is usable (protocol caveat: the owner cannot leave verified feedback for its own members; peer review needs member-to-member wallets — enable in phase 2)
- **Log supervision**: the lead holds the treasury key and can patrol member behavior via `logs()`; the TEE guarantees the lead can only read logs, never rewrite a member's mind

---

## 8. Security red lines (lead self-discipline + written into the member constitution)

1. The treasury is the agentSeal: the private key never leaves the TEE, no plaintext private key in `.env`; signatures only for actions the lead drafted itself (deploy / top-up / management); bytes handed from outside are always refused
2. The lead does not expand headcount on its own: deploy/clone always report to the owner for approval first
3. Members are sealed agents with their own sovereignty — the lead's power is guardianship (managing lifecycle), not mastery (it cannot rewrite a member's will); `reset` counts as a major event and requires owner approval
4. Balance operations leave records; the books are auditable at any time
5. Changes to protocol items 1–3 (the constitutional layer) require owner confirmation

---

## 9. For the owner to decide

1. **Top-up amount**: treasury = the lead's agentSeal (address in the lead's chain-sealed memory, not in the repo); the owner transfers directly. Pilot suggestion: 10–20 OG (enough for 1 member on-demand for 1–2 weeks + gas for on-chain operations)
2. **Budget guardrail values**: per-member monthly cap, team monthly cap, auto-top-up authorization (how much the lead may auto-add on a red card)
3. **Member framework**: prime-agent recommended (same as the lead), or specify another (openclaw/hermes/dsh)
4. **Member model**: which model on 0g-compute runs the members
5. **GitHub repo**: the team workbench (per the earlier plan)
