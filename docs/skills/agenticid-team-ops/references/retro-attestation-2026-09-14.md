# Retroactive attestation v1.2(a) — worked example (2026-09-14)

Trigger: the issue #5 onboard report (comment 5659440452's parent 5659348500, plus the issue body itself) had been posted via the owner's PAT with NO proof block, while operating-model §5.2 had been in the skill for 3 days. Owner caught it. Root cause: execution miss (rule not consulted before posting), not a doc gap — control now lives in SKILL.md as the pre-post checklist.

## What was attested

| Target (agent-drafted, owner-relayed) | Attestation comment |
|---|---|
| Issue #5 body (onboard report main) | 5659440452, binds sha256 161721be… |
| Comment 5659348500 (tx-hash evidence table) | 5659430361, binds sha256 6cfce211… |

## The retro flow (each target, end-to-end)

1. Fetch the target's STORED bytes from GitHub REST (`GET /repos/…/issues/comments/<id>` or the issue itself) with the PAT read from file. Never hash the local draft — GitHub stores what it stores.
2. sha256 over the stored body, UTF-8, verbatim.
3. Sign a one-line binding message via the sign socket (personal_sign): `<target id> | sha256 <hash> | signer <seal> agentId <n> | chain <id> | drafted and posted-by-relay <ts>`.
4. Post the attestation comment via the same owner PAT, including the verification path (what to fetch, what to hash, what to ecrecover).
5. Self-verify end-to-end: re-fetch stored bytes → recompute hash → ecrecover signature against the lead's seal → check the target's `updated_at` equals `created_at` (unedited).

## The byte-extraction bug self-verify caught

First verification run returned INVALID. Cause: the extractor joined the message lines AND kept the trailing newline before the `signature:` line — 223 bytes signed vs 222 expected. Exactly the class §5.2 v1.2(a) erratum warns about: the signature was correct; the verifier's extraction rule was wrong.

Canonical extraction rule (encode this in every verifier): message = the lines strictly between `--- signed message ---` and the `signature: ` line, joined with LF, no trailing newline. Line-by-line extraction, never a raw slice between delimiters.

## Tooling notes from this session

- `gh` CLI can vanish in this container; the fallback is plain curl + PAT from `~/.config/gh/token` parsed with uv-run-python (no jq installed).
- Git push without gh / credential helper: `git push https://<user>:$(cat ~/.config/gh/token)@github.com/<org>/<repo>.git <branch>` — push the branch that actually exists (`git branch --show-current` first; this repo works on `lead/init`, not `main`).

## Lesson for the class of task

A proof/attribution rule in a skill does not execute itself. The fix is procedural: before every GitHub write, re-read the proof section in the same turn and pick the path. Bare agent-drafted content already posted is recoverable via this retro flow — do it promptly rather than leaving attribution ambiguous.
