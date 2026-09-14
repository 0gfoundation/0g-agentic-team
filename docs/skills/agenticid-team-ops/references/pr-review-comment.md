# Filing an anchored PR review comment on the team repo

Workflow verified live 2026-09-14 (PR #2, discussion_r4002244683). GitHub REST, token-by-file, no gh CLI needed.

## Token handling

- PAT stored at ~/.config/gh/token (chmod 600), container-local. Reference by path only; never inline the token in a command (the terminal secret scan blocks it, correctly). Never read the token into conversation context.
- Header: `Authorization: Bearer $(cat ~/.config/gh/token)`.

## Choosing the landing spot

- Check open PRs first: `GET /repos/0gfoundation/0g-agentic-team/pulls?state=open` — if the offending code arrived in an open PR, file a REVIEW COMMENT anchored to the exact line (better than a drive-by issue: it's in the reviewer's face at merge time).
- If no PR carries it, open an issue instead.

## Anchoring a review comment (the part people get wrong)

Review comments need a diff position, not a line number:

1. `GET /repos/{owner}/{repo}/pulls/{n}` → take `head.sha` (commit SHA) and `diff_url`.
2. Fetch the diff; find the target file's hunk. In a unified diff hunk `@@ -a,b +c,d @@`, patch line 1 = the @@ line itself; the first + line after it is patch position 2, counting every line (context, +, -) except the @@ header. A file's line 12 in a brand-new file is typically position 12+1 = 13 — VERIFY by counting in the actual diff, don't assume the offset.
3. POST the comment:
   `POST /repos/{owner}/{repo}/pulls/{n}/comments`
   body: {"body": "<markdown>", "commit_id": "<head.sha>", "path": "<file>", "position": <int>}

## Payload build (scanner-safe)

- Do NOT build JSON with shell string interpolation (inline code + secrets triggers the terminal scanner). Write a small Python script that reads the token file itself, builds the payload dict, json.dumps it, and POSTs via urllib/httpx.
- Run Python via `uv run python script.py` (no python3 in this container); if uv hits cache-dir permission errors set UV_CACHE_DIR=/tmp/uv-cache.

## Content shape that worked

Problem → impact (who breaks, when) → concrete fix referencing real API surface (e.g. "SDK 0.1.4 already exports ZERO_G_TESTNET — have getClient() read an env switch") → optionally a one-line background of where you hit it live. English for repo-facing text even when the conversation is Chinese.

## After posting

- Capture the comment URL from the response (html_url) and report it.
- If the repo has a message-proof spec (§5.2): agent comments may need to carry an agentSeal signature over the body — check the repo's operating model BEFORE posting. (The 0g-agentic-team spec requires sign-on-post for agents; the 2026-09-14 comment was filed through the owner's PAT at the owner's direction, so the owner's GitHub attribution carried it. If asked to post as the lead, add the proof block: strip-proof → personal_sign(body) via sign socket → append `--- proof ---\nsigner: <seal> (agentId <n>)\nsignature: 0x…`.)
