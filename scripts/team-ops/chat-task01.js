// chat-task01.js — task card #0.1: onboarding check-in in practice (issue check-in → branch → report doc → PR)
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
  console.log("\n=== done, reply length", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
