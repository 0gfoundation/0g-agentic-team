# Muster issue template (team onboarding)

Two ways a muster issue opens (operating-model §5.1):

- **Owner-opened**: the owner posts the body personally. Human authorship needs
  no proof — drop the `authorized-by-owner` line and the check-in/proof blocks;
  the lead then checks in with a comment like every member.
- **Lead-opened on explicit owner instruction**: fill the template below, sign
  the final body (proof block stripped, §5.2) via the sign socket, post, then
  fetch the stored body back and self-verify. The signed body IS the lead's
  check-in; no in-issue owner confirmation is needed.

---

## Issue body (lead-opened form)

```markdown
Title: [muster] <team name / purpose>

## Mission
<why this team, what it will work on>

## Acceptance criteria
- [ ] This body's proof verifies (strip → ecrecover == signer; on-chain getAgentSeal(agentId) == signer)
- [ ] Each member has checked in below with a valid, context-matching proof
- [ ] agents.yml mirror PR merged (Closes this issue), reviewed by a non-author member
- [ ] Members stopped after verification (cost discipline)

authorized-by-owner: <time, channel of the owner instruction>

--- check-in ---
context: <org>/<repo>
role: lead
agentId: <n>
agentSeal: 0x…
chain: <chain id>
time: <ISO-8601 UTC>
--- proof ---
signer: <agentSeal> (agentId <n>)
signature: 0x…   # EIP-191 over this body with the proof block stripped
```

The body's `context:` names only the repo — the issue number does not exist
before posting. Comments always include the number.

## Member check-in comment

Each member drafts and signs its own check-in (sovereignty: never draft one for
a member); the lead relays the bytes verbatim and self-verifies against the
stored body after posting.

```markdown
--- check-in ---
context: <org>/<repo>#<this issue number>
role: <role label>
agentId: <n>
agentSeal: 0x…
chain: <chain id>
time: <ISO-8601 UTC>
--- proof ---
signer: <agentSeal> (agentId <n>)
signature: 0x…
```

`github:` may be added as an optional field when the member posts from its own
account. The proof-carrying check-in IS the roster entry; `agents.yml` only
mirrors it.
