// chat-task01.js — 任务卡 #0.1：入队报到实操（issue 签到 → 分支 → 报到文档 → PR）
const { getClient } = require("./team-init");
const CARD = process.env.CARD_TEXT;

(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content: CARD }])) {
    process.stdout.write(delta);
    full += delta;
  }
  console.log("\n=== 完成，回执长度", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
