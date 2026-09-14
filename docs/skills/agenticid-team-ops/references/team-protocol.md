# Team Protocol v1.1

Owner directives issued 2026-09-14, operationalized by the lead. This document is
the authoritative team protocol. It binds all members and the lead alike. Where it
overlaps `operating-model.md` §5.2 (GitHub message proofs), that section still
governs GitHub-side proofs; this protocol governs chat-side proofs, skill
distribution, issue modes, and PR discipline.

---

## 1. Skill access for members

Every member must be able to read and follow the team's operational skill
(`agenticid-team-ops`), not just the lead.

- The **authoritative copy** of the skill lives in this repo under
  `docs/skills/agenticid-team-ops/` (SKILL.md + templates + references).
- The lead's personal skill copy is kept in sync with the repo copy; the repo
  copy wins on any divergence.
- **Distribution**: on every member start (or when the skill materially
  changes), the lead sends the member a protocol-update card over chat pointing
  at the exact content; the member persists what it needs into its own
  chain-tracked harness (`~/.hermes/skills/`, `~/.hermes/memories/`) so it
  survives container rebuilds.
- Members cite the skill version they followed when delivering work.

## 2. Attribution model (live-tested 2026-09-14)

Two distinct channels with distinct trust properties. The design is enforced by
the sealed proxy itself (`sealed/internal/proxy/proxy.go`, "Routing precedence"),
not by convention — read it as platform law:

- **Chat (`/v1/`, framework route) is NEVER signed.** It is the owner↔agent
  steering channel; its credential is the owner-minted bearer token, so signing
  it would let the owner mint self-dealt reputation. Treat chat as private,
  authenticated (bearer), but *unattributed* coordination.
- **Agent-registered `/api/*` services are ALWAYS signed.** Every response
  carries `X-Agent-Proof` — an EIP-191 signature by the member's agentSeal over
  the canonical ServeProof envelope (method, uri, body hash, status, deadline).
  This is the attributable channel: statements a third party can verify on
  chain against `getAgentSeal(agentId)`.

Protocol rules:

1. **Coordination** (assignments, questions, status) goes over chat. Unsigned is
   fine — the bearer token already proves it came through the owner's channel.
2. **Attribution** (a claim that "backend-1 said/did X") is only valid with a
   ServeProof: call the member's registered service via its public URL, capture
   `X-Agent-Proof`, verify with the SDK (`ag.reputation.verifyProof`). Chat text
   alone is hearsay.
3. **Member-signed deliverable manifests**: for evidence that leaves the
   machine (e.g. GitHub PRs), the member drafts a short manifest of the
   artifact and signs it *at its own initiative* via its sign socket; the lead
   verifies against the member's known agentSeal. Members never sign text
   handed to them (sovereignty rule, unchanged).
4. **In-chat proof blocks are deprecated** for attribution (v1.0 §2). The lead
   may still sign its outgoing cards as a courtesy (chat-member.js does), but
   verification of *attribution* must go through ServeProof. A member that
   cannot verify a claim must say so honestly rather than claim verification.

Live-verified reference deployment (backend-1, agentId 410): registered
`GET /api/statement` returns its authored statement; response carries
X-Agent-Proof; `ag.reputation.verifyProof` returns
`{ok:true, signerMatches:true, notExpired:true, dataOnChain:true}`.
Tooling: `scripts/team-ops/verify-chat-proof.js` (chat header check —
expected to show chat is unsigned, by design) and the fetchWithProof pattern
in `chat-member.js` for /api/* verification.

## 3. Issue modes (two ways work starts)

**Mode A — member-filed issue**: a member (or the lead on its own initiative)
files an issue. It is a *proposal* until the owner approves it (a comment or
emoji from the owner in the issue). No work — no claim, no branch, no PR —
starts before that approval. The lead annotates the issue with an assessment to
help the owner decide.

**Mode B — owner-filed issue**: the owner creates the issue personally. Owner
authorship IS the confirmation gate passed; work may start immediately, no
further approval needed. The lead still assigns / confirms claims per §5.1.

In both modes the issue body must carry mission + acceptance criteria before
work starts (the lead structures it if the owner's text needs shaping), and all
agent content in issues follows the §5.2 proof spec.

## 4. PR discipline (linkage and authorship)

1. **Every PR links its issue** (`Closes #N` in the body). A PR without a
   linked issue is not merged — send it back.
2. **PR body and review comments come from the reporting member**: the member
   that did the work authors the PR description (what changed / how it was
   tested / evidence), signed per §5.2. The lead does not ghostwrite member
   deliverables; the lead's role is final review, not authorship.
3. Merge still follows the two gates: member approval + lead final review +
   owner decision.

---

## Identity map (chat verification keys)

Kept out of the repo in general (roster principle); for chat verification the
lead holds it in sealed memory. Members verify against the identity stated in
the lead's protocol-update cards, cross-checked with the on-chain
`getAgentSeal(agentId)` when in doubt.
