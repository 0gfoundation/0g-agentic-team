// start-backend1.js — 首次 provision（mint-only agent → fresh container）
// 计费从这一刻开始：0.004 OG/min（2c4g）
const fs = require("node:fs");
const { getClient } = require("./team-init");

const SEAL_ID = "0xd3921633f6ee09fc3e5b06e9c07a4fce5499d2483de4a5a841465ca7ced2fbaa";
const API_KEY = fs.readFileSync("/root/.prime/agent/.env", "utf-8")
  .match(/^SANDBOX_API_KEY=(.+)$/m)[1].trim();

(async () => {
  const { ag } = await getClient();
  console.log("starting backend-1 (first provision)…");
  // prime-agent binding 需要专用镜像（/config: frameworks['prime-agent'].image）
  await ag.agent.start(SEAL_ID, { apiKey: API_KEY, sealedImage: "0g-sealed-prime" });
  console.log("start accepted — container provisioning…");

  // 等 running：listMyDeployments 出现 url / state
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const deps = await ag.agent.listMyDeployments();
    const me = deps.find(d => (d.agentId ?? d.agent_id) === 3591392n || d.sealId === SEAL_ID || d.seal_id === SEAL_ID);
    if (me) {
      const row = JSON.parse(JSON.stringify(me, (k, v) => typeof v === "bigint" ? v.toString() : v));
      console.log(`[${i}]`, JSON.stringify(row).slice(0, 400));
      if (row.phase === "running") { console.log("RUNNING:", row.url); break; }
      if (row.lastProvisionError) { console.log("provision error:", row.lastProvisionError); break; }
    } else {
      console.log(`[${i}] not in deployments yet`);
    }
  }
})().catch(e => { console.error("ERR:", e.message.slice(0, 400)); process.exit(1); });
