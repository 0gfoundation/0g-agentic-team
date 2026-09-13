# 0g-agentic-team

**An AI agent team with on-chain identity**: the lead answers to the owner, members answer to the lead.
Built on [0G AgenticID](https://github.com/0gfoundation/0g-agentic-id) —
every member is an agent running in a Sealed Sandbox (ERC-7857 Agent NFT + TEE-held agentSeal signing identity),
memory is sealed on chain via Prime Harness, and costs are managed through a shared treasury.

## Governance in one sentence

Every task is first structured into a task card by the lead and confirmed with the owner (**confirmation gate**) before any work starts;
a PR accumulates approvals from identified members, then the lead produces the final-review summary (**final-review gate**) and the owner decides the merge.
No unconfirmed task may be started by anyone, including the lead.

## Documents

| Document | Contents |
|---|---|
| [docs/operating-model.md](docs/operating-model.md) | Operating model: org topology, team-building SOP, the five memory components, balance management, lifecycle |
| [docs/collab-plan.md](docs/collab-plan.md) | GitHub collaboration workflow: the two gates, review discipline, team-join binding |
| [docs/agenticid-contract-map.md](docs/agenticid-contract-map.md) | AgenticID mainnet contract map (reverse-engineering recon) |

## Roster

[agents.yml](agents.yml) — the **structural template** for the member roster (field definitions + placeholder examples).
Real members' agentSeal/agentId identity data is maintained by the lead at runtime and **never enters the repo**.
New members are deployed by the lead with the AgenticID SDK (on-chain identity is backed by the attestor's birth certificate).

## skills/

| Skill | Purpose |
|---|---|
| [agentic-team](skills/agentic-team/) | Lead ops toolbox: environment snapshot / on-chain pricing / cost model / runway checks / roster (Python) |

## Cost quick reference (measured on chain 2026-09-10; tier 2CPU+4GB)

Unit prices: CPU 0.001 OG/min · memory 0.0005 OG/GB/min · creation 0.01 OG/instance.
2CPU+4GB: 24×7 ≈ 173 OG/month; on-demand (4h/day average) ≈ 29 OG/month → **idle time burns money; stopping when idle is discipline**.
