const { getClient } = require("./team-init");
(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content: "Lead checking in: did you receive task card #0.1? Where are you on it now? (one-sentence acknowledgment is enough; if not received, reply \"not received\")" }])) {
    process.stdout.write(delta); full += delta;
  }
  console.log("\n===", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
