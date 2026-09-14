// chat-ping.js — bare unsigned ping (variable isolation for signed-chat debugging)
// Usage: node chat-ping.js <agentId> [message]
const AGENT_ID_RAW = process.argv[2] || "410";
const MSG = process.argv[3] || "Lead checking in: reply with the single word PONG. Nothing else.";
if (!/^\d+$/.test(AGENT_ID_RAW)) { console.error("usage: node chat-ping.js <agentId> [message]"); process.exit(1); }
const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(BigInt(AGENT_ID_RAW));
  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content: MSG }])) {
    process.stdout.write(delta); full += delta;
  }
  console.log("\n===", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
