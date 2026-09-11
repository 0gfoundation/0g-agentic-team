// chat-logs.js — 读 backend-1 进程日志（owner-signed /log/agent）
const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  const t = await c.logs({ tail: 80 });
  console.log(t);
})().catch(e => { console.error("ERR:", e.message.slice(0, 300)); process.exit(1); });
