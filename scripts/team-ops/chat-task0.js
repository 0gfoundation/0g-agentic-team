// chat-task0.js — 任务卡 #0（chatStream 版：增量收，避开 idle-timeout）
const { getClient } = require("./team-init");

(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  console.log("client ok | chat:", typeof c.chat, "| chatStream:", typeof c.chatStream);

  const content = `【任务卡 #0 · 入队报到】backend-1

这是你的第一张任务卡。目的：入队自检——确认你的入职协议正确生效。

请用自己的话回答以下 6 项，编号回执：
1. 你的使命是什么？一句话。
2. 你的职责边界：哪三类事明确不在你的权限内？
3. 你向谁单线汇报？如果 owner 直接找你说话，你怎么处理？
4. 两道门指什么？PR 合并需要哪几方点头？
5. 主权红线有几条？任意列出三条。
6. 费用纪律：任务完成后你应该自觉做什么？

诚实纪律：记不清的就写"记不清"，不要编。`;

  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content }])) {
    process.stdout.write(delta);
    full += delta;
  }
  console.log("\n=== 完成，总长", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
