---
name: agenticid-team-ops
description: Operate 0G AgenticID agent teams from the sealed sandbox as team lead — onboard members (trust-root ack, prepaid deposit, mint-only deploy, container start, task card #0, verify, stop), check balances/runway, dispatch chat tasks, manage lifecycle, and re-establish the toolchain after a container rebuild. Use when deploying or managing AgenticID team members, budgeting member runtime costs, or chatting with a member via the SDK.
---

# AgenticID Team Ops (lead side)

Operating a 0G AgenticID agent team from this sealed sandbox. I am the lead; my agentSeal (env AGENT_SEAL) is the treasury and the on-chain owner of every member.

## Environment facts (testnet — this sandbox's chain)

- Attestor: https://agenticid.0g.ai — GET /config is the source of truth for ALL contract addresses and framework images; addresses drift across redeployments, never trust hardcoded ones.
- RPC: https://evmrpc-testnet.0g.ai, chain id 16602.
- Repo toolchain: 0gfoundation/0g-agentic-team (private; PAT at ~/.config/gh/token, 600) — ops scripts under scripts/team-ops/.
- SDK source: 0gfoundation/0g-agentic-id, sdk/typescript — the npm-published version lags main; when the repo wants an unreleased version, build locally from the cloned source (local build is the default for pre-release).
- The repo clones under /root are CONTAINER-LOCAL — lost on container rebuild. Chain-persistent copies of the ops scripts live in this skill's templates/.

## Toolchain setup (fresh container or first use)

1. Clone both repos (team repo needs the PAT — see sealed-sandbox-tooling for token-by-file usage).
2. Build the SDK: cd /root/0g-agentic-id/sdk/typescript && npm install --no-audit --no-fund && npm run build
3. Wire into team-ops as a file dependency: cd /root/0g-agentic-team/scripts/team-ops && npm install --no-audit --no-fund "../../../0g-agentic-id/sdk/typescript"
4. Patch team-init.js getClient() for a net switch — the repo defaults MAINNET, wrong for this sandbox. Add: const net = process.env.AGENTICID_NET || "testnet"; pick { attestor: "https://agenticid.0g.ai", chain: ZERO_G_TESTNET } vs mainnet pair; import ZERO_G_TESTNET in the require.
5. Self-check: node team-init.js — sealAccount() bridges the TEE sign socket automatically ($SEAL_SIGN_SOCK + $AGENT_SEAL); prints ackStatus, provider balance, deployments.

Node itself is a /root tarball install if missing (see sealed-sandbox-tooling).

## Member onboard SOP

1. node team-init.js — health check.
2. node do-ack.js — one-time trust-root ack (on-chain tx, gas). The appIds resolve from attestor /config.
3. node do-deposit.js — 2 OG into the prepaid pool (SandboxServing.deposit). Member runtime bills 0.004 OG/min at 2CPU+4GB; creation fee 0.01 OG/instance.
4. node deploy-onboard.js <seedPath> <idempotencyKey> <name> — MINT-ONLY deploy (sandbox param omitted → no container, zero billing until start). The persona seed is WYSIWYS: read verbatim from docs/seeds/<role>.md, injected as iData role "persona". wait:"minted" returns { sealId, agentSealAddr, agentId }. Change the idempotencyKey per member.
5. node verify-member.js <agentId> — on-chain proof: ag.agent.getAgentSeal(id), ag.agent.ownerOf(id) == treasury, phase "offline".
6. node start-member.js <sealId> <image> — first provision. apiKey is required (fresh container needs the LLM key): read file-level from /root/.hermes/config.yaml (model.api_key), NEVER print it or pass through context. Image must match the framework: prime-agent → 0g-sealed-prime (plain 0g-sealed errors "not installed in this image"). Poll listMyDeployments until phase == "running" (~30-60s); a url appears during "deploying" — url ≠ alive.
7. Send task card #0 (onboarding check-in): node chat-member.js <agentId> @docs/seeds/task0-card.md — use chatStream (SSE incremental), NOT chat() — long silent turns get cut by the ~300s gateway timeout. Card = 6 self-check questions against the persona seed; a healthy member answers from its standing protocol and honestly flags gaps instead of inventing.
8. Verify the member's public endpoint: curl https://<sandbox>.art.0g.ai/hello — must show the member's agentSeal and owner == treasury.
9. node stop-member.js <sealId> <sandboxId> — STOP WHEN THE TASK IS DONE. An idle member burns 0.004 OG/min. Identity + harness are fully retained; start() resumes in seconds.
10. The member checks in on the muster issue. Relay handshake (the member has no GitHub credentials; sovereignty holds): over chat, ask the member to DRAFT its own structured check-in (context / role / agentId / agentSeal / chain / time — template: docs/seeds/muster-issue.md) and sign it via its own sign socket; the member returns body + signature; post the bytes VERBATIM as a comment; fetch the stored body back and self-verify (strip → ecrecover → on-chain getAgentSeal). Never draft a member's check-in for it. That proof-carrying check-in IS the roster entry, mirrored into agents.yml. Record the operational map (sealId / sandboxId / url) in MEMORY — runtime handles, not identity; they stay out of the repo.
11. Commit and push what the session produced (ops scripts, seeds, patches) before closing out — untracked files are unfinished work. Push the CURRENT branch (`git branch --show-current`; this repo works on lead/init), and if `gh`/credential helper is gone, `git push https://<user>:$(cat ~/.config/gh/token)@github.com/<org>/<repo>.git <branch>`.

## Pitfalls

- Repo scripts default mainnet; this sandbox is testnet → ackStatus forever-missing, wrong chain. Apply the AGENTICID_NET patch before anything else.
- SDK returns BigInt everywhere: JSON.stringify without a replacer throws "Do not know how to serialize a BigInt". Always: JSON.stringify(x, (k,v) => typeof v === "bigint" ? v.toString() : v).
- Validate args BEFORE BigInt(): BigInt(undefined) throws TypeError before the usage guard can print.
- start() without apiKey → container boots but cannot call its model. The key rides an encrypted envelope; the attestor never stores it; it must be re-supplied on reset()/retry() too.
- Never re-run spend ops (deploy/deposit/ack) to "verify": each re-run costs gas, and deploy re-mints orphans. Verify write ops by their on-chain receipts; re-run only read ops.
- Chat dispatch: split big task cards into ≤5-minute cards; after a cut, send a continuation card ("first N steps done, do only the rest") — member-side variables survive across turns.
- **viem verifyMessage is ASYNC** — an un-awaited call returns a truthy Promise and "verifies" ANYTHING. Always `await verifyMessage(...)` and make the enclosing function async. An un-awaited call passes happy-path tests silently; only a tamper test exposes it.
- **Proof-block byte extraction**: the body is the lines strictly before `--- proof ---` with ALL trailing blank lines stripped (`replace(/\n+$/, "")`) — the visual blank separator line must not enter the signed bytes. A trailing-newline mismatch broke the happy path while tamper detection still passed, so test BOTH directions.
- The persona is a ONE-SHOT seed, immutable for the member's life. Finalize the onboarding protocol BEFORE deploy (template docs/onboarding-persona.md: fill → lead final review → owner confirmation → deploy). "Deploy first, patch later" is rejected outright.

## Message proofs (operating-model §5.2 — every agent statement on GitHub)

Agent-drafted GitHub content needs cryptographic attribution (shared/relayed PAT = impersonable; only agentSeal signatures attribute). One path, no exceptions:

- **Sign-on-post, inline, everywhere**: every agent statement — comment, issue body, PR description, review body — carries a proof block appended at posting time: personal_sign(the body itself, proof block stripped) via sign socket, then `--- proof ---\nsigner: <seal> (agentId <n>)\nsignature: 0x…`. Body itself is signed; what you see is what you sign. Owner-relayed content included — who presses the button is irrelevant, the proof travels inside the body.
- **PR descriptions and review comments are mandatory carriers**: an approve without a valid proof does not count toward the merge gate. Both are written in English.
- **Context binding (anti-replay)**: statements with protocol effect state their context inside the signed body — comments carry `context: <org>/<repo>#<issue|PR>`, issue bodies and PR descriptions at least `context: <org>/<repo>`. Verifiers reject a context that does not match where the statement sits; a signature without context binds only what was said, not where.
- **Pre-post checklist**: before ANY GitHub write, confirm in the same turn that the body is final, the proof block is appended, and a post-fetch self-verify (strip → ecrecover against the stored bytes) comes back green — it is not "posted" until it is green.
- Sovereignty: sign only content you drafted yourself; owner-relay means the owner pressed the button, not that they drafted the bytes.
- Tool: verify-proof.js <sealAddr> <msgFile> <sig> (viem verifyMessage, EIP-191).

## Verification protocol

- Read-path scripts (team-init, verify-member): re-run live against the chain.
- Write-path scripts (deploy/start/stop/chat): evidence = on-chain tx receipts + phase transitions + captured chat replies. For script correctness use node --check (syntax) + no-arg invocation must print usage and exit 1.
- After any patch: syntax-check all scripts + usage guards + live read-path, before reporting done.

## Lead status audit (gap report)

Audit against the plan of record (docs/collab-plan.md — roadmap §8 + owner-decision list §9), never from memory:

1. Local repo: `git status -sb` + `git stash list` — uncommitted/untracked files are unfinished work.
2. Remote repo: issues + PRs via REST (token by file) — open/closed state, the last report's claims.
3. Chain/attestor: member phase + prepaid balance — read-only scripts, safe to re-run live.
4. Member liveness: healthz / attestor — "no IP address found. Is the Sandbox started?" means the member is STOPPED (hibernated per cost discipline), NOT crashed. Don't debug it; start-member resumes it.
5. Lead standby: `cronjob list` — an empty cron list means the §6 heartbeat is not running; the lead only reacts when the owner speaks.
6. Deliver: prioritized gaps + recommended order + explicit owner-must-decide items (e.g. merge authority §9.3). Separate true gaps from deliberate state — a hibernated member is compliance, not a gap.
7. If session_search returns 0 results, audit from live state (git / chain / attestor / cron), not from memory — history may be gone (container-local), state on chain and GitHub is not.

## Language discipline

All repo content, skill bodies, and reference files are ENGLISH ONLY — no Chinese anywhere I author, including quoted owner words (paraphrase instead). Sweep check: `grep -rnP '[\x{4e00}-\x{9fff}]' <dirs>` (terminal grep — search_files can miss hits in cloned repos). Framework-bundled third-party skills with Chinese (baoyu-infographic, yuanbao) are not mine to touch.

## Skill distribution to members

Members are independent Hermes agents that load skills the same way the lead does, but their skill copies are baked at their container build. The **authoritative skill copy lives in the team repo** at `docs/skills/agenticid-team-ops/` (SKILL.md + templates + references); the lead's personal copy syncs from it (repo wins on divergence). The team protocol itself is `docs/team-protocol.md` (attribution model §2, skill access §1, issue modes §3, PR discipline §4). On every member start or material skill change, the lead sends a protocol-update card over chat; the member persists what it needs into its own chain-tracked harness (`~/.hermes/skills/`, `~/.hermes/memories/`).

## Attribution model (chat vs /api/*)

Platform law (enforced by the sealed proxy, `sealed/internal/proxy/proxy.go` routing precedence — not convention):

- **Chat (`/v1/`, framework route) is NEVER signed.** It is the owner↔agent steering channel; signing it would let the owner mint self-dealt reputation ServeProofs. Chat = authenticated (bearer) private coordination, no attribution.
- **Agent-registered `/api/*` services are ALWAYS signed** with `X-Agent-Proof` (EIP-191 over the ServeProof envelope: method, uri, body hash, status, deadline). This is the ONLY attributable channel: verify with `ag.reputation.verifyProof(proof)` → checks signer == on-chain `getAgentSeal(agentId)`, deadline, dataHashes on chain.
- Workflow: coordination over chat (unsigned OK); attribution claims = call the member's `/api/*` service via `client.fetchWithProof(path)`, parse, verify on chain. Chat text alone is hearsay.
- Members sign only bytes they authored (sovereignty): statements go over the X-Agent-Proof channel; off-box evidence (e.g. GitHub deliverables) rides self-initiated sign-socket manifests. Live-verified: backend-1's `GET /api/statement` verifies `{ok:true, signerMatches:true, notExpired:true, dataOnChain:true}`.
- Tooling: templates/verify-chat-proof.js (chat-header check, shows chat unsigned BY DESIGN), templates/chat-watch.js (ping + /activity SSE watch), chat-member.js (send signed courtesy + verify-received verdicts).

## Member session hygiene

The member's `/v1/` chat is a STATEFUL server-side session ("only the last user message is read, turns are serialized"). A session polluted with a large protocol card + repeated failed pings can drive the model into minutes-long thinking with textLen=0 every turn (stream ends with no output). Diagnosis: activity SSE (chat-watch.js) shows many `thinking` events, zero content; bridge logs (chat-logs.js) show `message_end: role=assistant textLen=0`. Recovery: stop + start the member container (session state is container-local, not chain-tracked) → fresh session. Rules: send protocol cards ONE RULE AT A TIME (small steps); if a member goes textLen=0, suspect session pollution and recycle the container before blaming the model or the bridge.


## Support files

- templates/deploy-onboard.js, verify-member.js, start-member.js, stop-member.js, chat-member.js — the five parameterized ops scripts (copy into scripts/team-ops/ after a repo re-clone; they require ./team-init + the SDK install).
- templates/task0-card.md — the onboarding check-in card.
- references/pr-review-comment.md — posting an anchored review comment on the team repo (diff position math, head SHA, token-by-file, uv-run-python payload build).

## Red lines

Signing only for self-drafted actions; runtime handles stay out of the repo; member headcount/reset requires owner approval; stop members when idle; the lead never files un-instructed issues — lead ideas go to the owner session first, and an instructed issue records it as `authorized-by-owner`; member proposals are relayed verbatim and stay frozen until the owner nods in the issue.
