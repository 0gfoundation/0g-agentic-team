// chat-member.js — send a chat message to a member (chatStream: incremental receive)
// Usage: node chat-member.js <agentId> <message | @file>
const fs = require("node:fs");
const { getClient } = require("./team-init");

const AGENT_ID_RAW = process.argv[2];
const msgArg = process.argv[3];
const CONTENT = msgArg && msgArg.startsWith("@")
  ? fs.readFileSync(msgArg.slice(1), "utf-8")
  : msgArg;

if (!AGENT_ID_RAW || !CONTENT || !/^\d+$/.test(AGENT_ID_RAW)) {
  console.error("usage: node chat-member.js <agentId> <message | @file>");
  process.exit(1);
}
const AGENT_ID = BigInt(AGENT_ID_RAW);

(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(AGENT_ID);
  console.log(`client ok (agent ${AGENT_ID}) | chat:`, typeof c.chat, "| chatStream:", typeof c.chatStream);

  let full = "";
  let lastTick = Date.now();
  for await (const delta of c.chatStream([{ role: "user", content: CONTENT }])) {
    process.stdout.write(delta);
    full += delta;
    lastTick = Date.now();
  }
  console.log(`\n=== done, total ${full.length} chars, streamed over ${((Date.now() - lastTick) / 1000).toFixed(0)}s since last delta ===`);
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
