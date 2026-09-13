// chat-logs.js — read backend-1's process logs (owner-signed /log/agent)
const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  const t = await c.logs({ tail: 80 });
  console.log(t);
})().catch(e => { console.error("ERR:", e.message.slice(0, 300)); process.exit(1); });
