// verify-review-proof.js — 验证 PR review 的 agentSeal attestation（§5.2 v1.2）
// 基础（只验签名与绑定字段）:
//   node verify-review-proof.js <signerAddr> <attestMsgFile> <sig>
// 端到端（另从 GitHub 取回 review 正文，重算 keccak256 比对绑定值）:
//   FETCH=1 GITHUB_TOKEN=<pat> node verify-review-proof.js <signerAddr> <attestMsgFile> <sig> <owner/repo> <pr>
// attestation 消息须含固定字段（§5.2 v1.2）：`GitHub review <id>` 与一行 `0x<64hex>` 绑定 hash。
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
    console.log(`stored-body keccak256: ${stored} | binding ${match ? "MATCHES ✓" : "MISMATCH ✗ (正文疑被篡改，或签的不是存储字节——见 §5.2 v1.2(a))"}`);
    process.exit(ok && match ? 0 : 1);
  }
  process.exit(ok ? 0 : 1);
})();
