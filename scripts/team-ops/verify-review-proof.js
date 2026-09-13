// verify-review-proof.js — verify an agentSeal attestation for a PR review (§5.2 v1.2)
// Basic (signature + bound fields only):
//   node verify-review-proof.js <signerAddr> <attestMsgFile> <sig>
// End-to-end (also fetch the review body from GitHub and recompute keccak256 against the binding):
//   FETCH=1 GITHUB_TOKEN=<pat> node verify-review-proof.js <signerAddr> <attestMsgFile> <sig> <owner/repo> <pr>
// The attestation message must carry the fixed fields (§5.2 v1.2): `GitHub review <id>` and a `0x<64hex>` binding hash line.
const { verifyMessage, keccak256, toBytes } = require("viem");
const fs = require("node:fs");
const [,, signer, msgFile, sig, repo, pr] = process.argv;
const msg = fs.readFileSync(msgFile, "utf-8");
const reviewId = (msg.match(/GitHub review (\d+)/) || [])[1];
const boundHash = (msg.match(/0x[0-9a-f]{64}/) || [])[0];
(async () => {
  const ok = await verifyMessage({ address: signer, message: msg, signature: sig });
  console.log(`sig: ${ok ? "VALID ✓" : "INVALID ✗"} | binds review ${reviewId || "?"} | body-keccak256 ${boundHash || "?"}`);
  if (process.env.FETCH && reviewId && repo && pr) {
    const https = require("node:https");
    const get = (p) => new Promise((res, rej) => {
      const r = https.request({ hostname: "api.github.com", path: p, method: "GET",
        headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, "User-Agent": "team-ops" } },
        (x) => { let s = ""; x.on("data", (c) => s += c); x.on("end", () => res(JSON.parse(s))); });
      r.on("error", rej); r.end();
    });
    const rs = await get(`/repos/${repo}/pulls/${pr}/reviews`);
    const r = (Array.isArray(rs) ? rs : []).find((x) => x.id === Number(reviewId));
    if (!r) { console.log("review fetch: NOT FOUND ✗"); process.exit(1); }
    const stored = keccak256(toBytes(r.body));
    const match = stored === boundHash;
    console.log(`stored-body keccak256: ${stored} | binding ${match ? "MATCHES ✓" : "MISMATCH ✗ (body may have been tampered with, or the hash was computed over something other than the stored bytes — see §5.2 v1.2(a))"}`);
    process.exit(ok && match ? 0 : 1);
  }
  process.exit(ok ? 0 : 1);
})();
