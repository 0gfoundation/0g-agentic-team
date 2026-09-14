# Onboard evidence — 2026-09-14 (testnet, live run)

First successful end-to-end two-person onboard from this sandbox. Everything below is from real execution, not rehearsal.

## Team identity map (also in MEMORY)

- Lead: agentId 409, seal 0x5744DE7Fbf2339b7b3aD00183b27EACC07C67C62 (= treasury; env AGENT_SEAL)
- Member backend-1: agentId 410, seal 0x9d014a0F6560800f4fF501146a41bF6F483E9a2F, sealId 0xca81671c4355aab1e1a5bace0540be590589704b8116e2ce6b160628fc954263, sandboxId ca7e6d40-6c15-47b3-b239-2aeb7c2b845d, image 0g-sealed-prime, url https://8080-ca7e6d40-6c15-47b3-b239-2aeb7c2b845d.art.0g.ai

## Timeline with tx hashes

| Step | Evidence | Cost |
|---|---|---|
| trust-root ack | tx 0x0f439e4d36679cde3b0827d89b26875374fe1bc96aa448424d5d316ecbf16bae, block 54753311, success | gas |
| deposit 2 OG → prepaid pool | tx 0x25574e2c92d7b029aa3664de37b186edf925f60090f9b8064b801ad7f19aa4e8, gasUsed 56970, success | 2 OG |
| mint-only deploy backend-1 | agentId 410; ownerOf(410) == treasury verified on chain | 0 (no container) |
| start → running | phase deploying → running in ~30s (2 polls); sandboxId assigned | billing starts |
| task card #0 | chatStream round trip, member reply 3036 chars | ~min of runtime |
| stop | phase stopped on first poll (~5s); billing ends | — |

Native gas after all ops: ~7.9 OG (started ~9.96). Prepaid after ~min of member runtime: 1.924 OG.

## Task card #0 reply characteristics (what a healthy member looks like)

- Answered all 6 items from its standing protocol (mission/boundary/reporting line/two gates/5 red lines/cost discipline), correctly.
- Opened by declaring its source: "answers come from my standing protocol as loaded at boot; I consulted no other source (harness memory is empty)".
- On the one item with no written procedure (direct owner contact), said "I do not remember" + a sensible default + "if the lead wants different handling, correct me" — exactly the honesty discipline the seed demands.
- Proactively flagged two real gaps: no GitHub credentials in its runtime (can't do repo-side work yet — needs lead-provisioned PAT per protocol), and the card carried no GitHub issue reference.
- The flags were the most valuable part of the check-in: they surfaced the next real onboarding steps (member GitHub access is a lead/owner decision, not a deploy-time default).

## Bugs found during the run (both fixed, both live-verified)

1. team-init.js main block: JSON.stringify(deployments) crashed "Do not know how to serialize a BigInt" the moment deployments became non-empty — the repo's self-check could never pass after the first member. Fixed with the bigint-to-string replacer. (Same bug shape exists in upstream repo scripts — worth a comment if seen again.)
2. chat-member.js: BigInt(process.argv[2]) threw TypeError on missing arg BEFORE the usage guard — validation order fix (validate raw, then BigInt).

## Verification protocol used (10/10)

- Read-path live: team-init.js (allAcked true, balance, non-empty deployments serializing clean), verify-member.js (seal mapping, NFT owner, phase).
- Write-path static: node --check ×6, usage guards (no-arg → usage + exit 1).
- Never re-ran spend ops to verify — receipts + phase transitions are the evidence; re-running deploy mints orphans and re-bills.

## Open items at session end (owner decisions pending)

- Member GitHub PAT (least-privilege, this-repo-only, per operating-model red line #2) — member cannot touch the repo without it.
- Owner's own PAT (used for cloning/filing the PR comment) was exposed in chat and should be rotated.
- Upstream PR #2 review comment filed on the hardcoded-mainnet issue: https://github.com/0gfoundation/0g-agentic-team/pull/2#discussion_r4002244683
