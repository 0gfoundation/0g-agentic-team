// chat-task0.js — task card #0 (chatStream edition: incremental receive, dodges the idle timeout)
const { getClient } = require("./team-init");

(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(3591392n);
  console.log("client ok | chat:", typeof c.chat, "| chatStream:", typeof c.chatStream);

  const content = `[Task card #0 · Onboarding check-in] backend-1

This is your first task card. Purpose: an onboarding self-check — confirm your onboarding protocol took effect correctly.

Answer the following 6 items in your own words, numbered:
1. What is your mission? One sentence.
2. Your responsibility boundary: which three categories of things are explicitly outside your authority?
3. Who do you report to, single-line? If the owner speaks to you directly, how do you handle it?
4. What are the two gates? Whose nods does a PR merge need?
5. How many sovereignty red lines are there? List any three.
6. Cost discipline: what should you voluntarily do once a task is done?

Honesty discipline: for anything you do not remember, write "do not remember" — do not invent.`;

  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content }])) {
    process.stdout.write(delta);
    full += delta;
  }
  console.log("\n=== done, total length", full.length, "===");
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
