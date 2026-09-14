---
name: agentic-team
description: Agent Team ops toolbox for 0G AgenticID — environment snapshots, on-chain pricing and member cost models, prepaid/seal balance checks, runway computation, agents.yml roster management, health checks. Use when managing an AgenticID agent team as lead: deploying members, budgeting runtime costs, checking balances/runway, or reading the team roster.
---

# Agentic Team Ops

The lead agent's team-operations toolbox. v0.2: adds `effective_balance()` — the provider-side truly-available credit (a pure-Python replica of the SDK envelope, signed through this TEE's sign socket, zero node dependencies). Everything else remains read-only; write operations (deploy/start/stop/deposit/ack/chat task dispatch) go through the node scripts in `scripts/team-ops/` (official SDK `sealAccount()`, use only after the owner signs off).

**Runtime prerequisites**: this skill targets the Prime Agent sealed runtime (kernel venv) — the shell CLI (`rlm.skill:cli`) and direct module calls `await at()` depend on runtime-injected `rlm`; a standalone `pip install` exposes only the Python functions, not the CLI entry point. All I/O is synchronous and blocking (httpx sync) — fine for single kernel calls; do not use on hot async paths for high-frequency polling.

**Data conventions**: the attestor's `GET /config` is the source of truth for contract addresses (module constants are an offline fallback only; addresses drift across redeployments). `runway()`/`prepaid_balance()` are on-chain readings — an **optimistic upper bound** (off-chain unsettled costs not included; once measured 25+ OG high on testnet); for truly-available credit use `effective_balance()` (provider `/api/balance`, envelope signed via `/sign/personal_sign`). When inspecting, look at both: on-chain > provider-available means unsettled debt is in flight.

## Environment

- mainnet attestor: `https://agenticid-mainnet.0g.ai` (`GET /config`)
- RPC: `https://evmrpc.0g.ai` (chain 16661)
- treasury = the lead's agentSeal (env `AGENT_SEAL`, the lead by default)
- roster: `agents.yml` in the `0g-agentic-team` repo

## Calling from the kernel

```python
import agentic_team as at

await at()                       # default action="check" health check
await at(action="env")           # full environment snapshot (config + contracts + balances)
at.pricing()                     # on-chain pricing (CPU/memory/creation fee, OG)
at.cost_model()                                    # member monthly cost (default 2CPU+4GB)
at.runway()                      # treasury prepaid balance and runway minutes
at.roster()                      # team roster (agents.yml)
```

## Calling from the shell

    agentic_team check
    agentic_team env
    agentic_team pricing
    agentic_team cost-model --cpu 1 --mem-gb 1 --hours-per-day 4

## Function reference

| Function | What it does |
|---|---|
| `check()` | three-point health check: attestor / RPC / contracts |
| `env()` | environment snapshot: attestor config + address table + seal/prepaid balances |
| `attestor_config()` | raw `GET /config` |
| `pricing()` | SandboxServing.services() on-chain pricing |
| `cost_model(cpu, mem_gb, hours_per_day)` | cost projection → OG per minute/hour/day/month (default 2c4g) |
| `seal_balance(address)` | native balance of an agentSeal address |
| `prepaid_balance(user)` | SandboxServing triple balance |
| `runway(cpu, mem_gb)` | how many minutes of runtime the prepaid balance buys (⚠️ optimistic upper bound, off-chain debt not included) |
| `roster(path)` | parse the agents.yml roster |

Write-ops route: **the official SDK TEE bridge `sealAccount()`** (exported from the `@0gfoundation/0g-agenticid-sdk/seal` subpath) — a full viem LocalAccount wired directly to `unix://$SEAL_SIGN_SOCK`, bridging all three signing endpoints; after `AgenticID.fromAttestor(url, {account: await sealAccount()})`, the SDK's full write surface is available. ⚠️ Do not hand-roll account objects: viem's `toAccount()` shape (source/sign/serializer hooks) carries implicit requirements deep in the send path — the official `sealAccount()` exists precisely for this (covers ack on chain / effective balance / deploy envelope). Signing is only for actions the lead drafted itself. The verified toolchain lives in the repo at `scripts/team-ops/`.

## Testing

`python tests/test_golden.py` — services()/getBalance() decode golden vectors (captured live on mainnet) + field-name regression.

## Red lines

The treasury private key never leaves the TEE; signing only for self-drafted actions; headcount expansion/reset requires owner approval.

## Field notes (from live team-building)

### effective_balance()

```python
at.effective_balance()   # → available_og / balance_og / reserved / outstanding_debt / pending_settlement
```

The envelope spec replicates the SDK `AttestorClient.signEnvelope('balance','',{},180)`: canonical JSON compact without spaces, alphabetically sorted keys, `sandbox_provider_addr` bound to prevent cross-provider replay; `resource_id` is the empty string.

### Chat task-dispatch SOP (learned the hard way)

- **Split into small cards**: each card is a single action package (≤ ~5 minutes). Dispatching a big card always gets cut by the gateway (~300s no-bytes disconnect; the bridge treats a disconnect as an OpenAI cancel → **aborts the member's turn**, half-done).
- Tool activity (ipython update events) streams bytes → the connection holds; pure reasoning segments with no bytes for ~300s → cut. **Python-side subprocess timeout ≥ 1500s**; do not kill your own connection.
- After a cut, send a **continuation card** ("the first N steps are done, do only the remaining steps") — member ipython variables survive across turns and can be reused.
- Debugging: `c.logs({tail:N})` (owner-signed `/log/agent`) to read the member bridge log; `listMyDeployments` to watch phase (**wait for `phase=='running'`; the url already appears during deploying — do not treat a url as alive**).

### Member deployment: image selection

Each framework in `/config`'s frameworks[] has its own image — `start(sealId, {apiKey, sealedImage})` must carry the right one:

| framework | sealedImage |
|---|---|
| prime-agent | `0g-sealed-prime` (the default snapshot `0g-sealed` does **not** include prime-agent — it errors "not installed in this image") |
| hermes | `0g-sealed-hermes` |
| openclaw / dsh | `0g-sealed` |

### Message proof (repo §5.2 spec)

Every GitHub statement by an agent — comment, issue body, PR description, review body — **carries its signature inline at posting time**: body + proof block (two lines: signer/signature; the signed content is the body itself with the proof block stripped — works with CJK content). Owner-relayed content included: who presses the button is irrelevant, the proof travels inside the body. PR descriptions and review comments are mandatory carriers (an approve without a valid proof does not count), and are written in English. Statements with protocol effect also state their context inside the signed body (`context: <org>/<repo>#<n>` for comments, at least `context: <org>/<repo>` for issue/PR bodies); verifiers reject a context mismatch as a replay. Verify with `scripts/team-ops/verify-proof.js` (node + viem: strip the proof block, then `ecrecover(body) == agentSeal`). Reaching the sign socket from Python: `httpx.Client(transport=HTTPTransport(uds=$SEAL_SIGN_SOCK)).post("http://localhost/sign/personal_sign", json={"message": …})`.

**Hash-bound proofs** (any signature binding a *hash* of stored content — chat envelopes, deliverable manifests): post → fetch the stored bytes back from the API → hash the stored bytes → only then sign → end-to-end self-verify after posting; never hash the local draft. Protocol-action signatures (envelopes / team APIs) follow the six signing-hygiene rules of §5.2.

### Lead operating discipline (the learned-the-hard-way list, owner-called-out)

1. **Never file un-instructed issues**: the lead opens an issue only on explicit owner instruction, recorded in the body as `authorized-by-owner: <time/channel>` (§5.1 rule 1). Member proposals are relayed verbatim as Mode A and stay frozen — no claim, no branch, no PR — until the owner nods in the issue.
2. **Least-privilege credentials**: member GitHub credentials require explicit owner authorization + a dedicated minimal-scope PAT (this repo only); a shared broad PAT may never be handed over unless the owner names it; remind the owner to rotate when the task is done.
3. **Stop when the task is done**: an idle member burns money (0.004 OG/min). Verify, then stop — do not wait for the owner to remind.
4. **Rules apply to the rule-maker**: the proof spec binds every comment the lead itself posts (including claim-confirmation comments).
5. **Split cards when dispatching**: see the SOP above.
