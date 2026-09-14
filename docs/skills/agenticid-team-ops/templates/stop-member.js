// stop-member.js — stop a member's container (identity + harness fully retained; start() resumes in seconds)
// Usage: node stop-member.js <sealId> <sandboxId>
// Cost discipline: an idle member burns 0.004 OG/min — verify, then stop, don't wait to be reminded.
// Args are REQUIRED (no defaults — stopping the wrong sandbox is a real hazard).
const { getClient } = require("./team-init");

const SEAL_ID = process.argv[2];
const SANDBOX_ID = process.argv[3];

if (!SEAL_ID || !SANDBOX_ID) { console.error("usage: node stop-member.js <sealId> <sandboxId>"); process.exit(1); }

(async () => {
  const { ag, account } = await getClient();
  console.log("stopping member", SEAL_ID.slice(0, 10) + "…", "as", account.address);
  await ag.agent.stop(SEAL_ID, SANDBOX_ID);
  console.log("stop accepted — verifying phase…");
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const deps = await ag.agent.listMyDeployments();
    const me = deps.find(d => d.sealId === SEAL_ID || d.seal_id === SEAL_ID);
    if (me) {
      const row = JSON.parse(JSON.stringify(me, (k, v) => typeof v === "bigint" ? v.toString() : v));
      console.log(`[${i}] phase:`, row.phase, "| sandboxId:", row.sandboxId);
      if (row.phase === "stopped" || row.phase === "offline") { console.log("STOPPED ✓"); break; }
    }
  }
})().catch(e => { console.error("ERR:", e.message.slice(0, 400)); process.exit(1); });
