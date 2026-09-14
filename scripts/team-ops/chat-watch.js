// chat-watch.js — ping a member while watching its /activity SSE stream
// Usage: node chat-watch.js <agentId> [message]
const AGENT_ID_RAW = process.argv[2] || "410";
const MSG = process.argv[3] || "Reply with the single word PONG. Nothing else.";
if (!/^\d+$/.test(AGENT_ID_RAW)) { console.error("usage: node chat-watch.js <agentId> [message]"); process.exit(1); }
const { getClient } = require("./team-init");
const t0 = Date.now();
const ts = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(BigInt(AGENT_ID_RAW));
  let full = "";
  for await (const delta of c.chatStream(
    [{ role: "user", content: MSG }],
    { onActivity: (a) => console.log(`[${ts()}] ACTIVITY: ${a}`) }
  )) {
    process.stdout.write(delta); full += delta;
  }
  console.log(`\n[${ts()}] === done, ${full.length} chars ===`);
})().catch(e => { console.error(`\n[${ts()}] ERR:`, e.name, e.message.slice(0, 300)); process.exit(1); });
