// start-member.js — first provision of a mint-only member (billing starts NOW: 0.004 OG/min, 2c4g)
// Usage: node start-member.js [sealId] [image]
// apiKey (required in practice: the fresh container needs the LLM key) is read file-level from the
// lead's sealed config — never printed, never passed through conversation context. It rides an
// encrypted envelope into the member's TEE; the attestor never stores it → must be re-supplied
// on every reset()/retry() too.
// Image MUST match the framework (attestor /config frameworks[]): prime-agent → 0g-sealed-prime.
// Plain 0g-sealed errors "not installed in this image". A url during "deploying" is not alive.
const fs = require("node:fs");
const { getClient } = require("./team-init");

const SEAL_ID = process.argv[2] || "0xca81671c4355aab1e1a5bace0540be590589704b8116e2ce6b160628fc954263";
const IMAGE = process.argv[3] || "0g-sealed-prime";

const API_KEY = fs.readFileSync("/root/.hermes/config.yaml", "utf-8")
  .match(/^\s*api_key:\s*(\S+)\s*$/m)[1].trim();

(async () => {
  const { ag, account } = await getClient();
  console.log("starting member", SEAL_ID.slice(0, 10) + "…", "image:", IMAGE, "as", account.address);
  await ag.agent.start(SEAL_ID, { apiKey: API_KEY, sealedImage: IMAGE });
  console.log("start accepted — container provisioning…");

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const deps = await ag.agent.listMyDeployments();
    const me = deps.find(d => d.sealId === SEAL_ID || d.seal_id === SEAL_ID);
    if (me) {
      const row = JSON.parse(JSON.stringify(me, (k, v) => typeof v === "bigint" ? v.toString() : v));
      console.log(`[${i}]`, JSON.stringify(row).slice(0, 300));
      if (row.phase === "running") { console.log("RUNNING:", row.url); break; }
      if (row.phase === "failed" || row.lastProvisionError) { console.log("PROVISION ERROR:", row.lastProvisionError); break; }
    } else {
      console.log(`[${i}] not in deployments yet`);
    }
  }
})().catch(e => { console.error("ERR:", e.message.slice(0, 400)); process.exit(1); });
