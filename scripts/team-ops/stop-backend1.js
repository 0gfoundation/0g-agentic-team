// stop-backend1.js — 停容器（保身份，断计费）
const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  await ag.agent.stop(
    "0xd3921633f6ee09fc3e5b06e9c07a4fce5499d2483de4a5a841465ca7ced2fbaa",
    "378f1f61-bb56-492f-b0f7-f56b212fc93d"
  );
  const deps = await ag.agent.listMyDeployments();
  const me = deps.find(d => d.agentId === 3591392n);
  console.log("stopped. phase:", me.phase);
})().catch(e => { console.error("ERR:", e.message.slice(0, 300)); process.exit(1); });
