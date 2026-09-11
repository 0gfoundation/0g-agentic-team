const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content: "lead 检查：任务卡 #0.1 收到了吗？现在进行到哪一步？（一句话回执即可；如果没收到，回\"未收到\"）" }])) {
    process.stdout.write(delta); full += delta;
  }
  console.log("\n===", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
