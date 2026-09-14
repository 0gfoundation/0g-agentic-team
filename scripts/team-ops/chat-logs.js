// chat-logs.js — read a member's process logs (owner-signed /log/agent)
// Usage: node chat-logs.js <agentId> [tail]
const AGENT_ID_RAW = process.argv[2] || "410";
const TAIL = process.argv[3] || "80";
const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(BigInt(AGENT_ID_RAW));
  const t = await c.logs({ tail: Number(TAIL) });
  console.log(t);
})().catch(e => { console.error("ERR:", e.message.slice(0, 300)); process.exit(1); });
