// deploy-backend1.js — mint-only: mint backend-1 (no sandbox payload → no container, no create fee)
// The persona seed is read from docs/seeds/backend-1.md (WYSIWYS: what gets read in is what gets sealed)
const fs = require("node:fs");
const path = require("node:path");
const { getClient } = require("./team-init");

const SEED = fs.readFileSync(
  path.join(__dirname, "..", "..", "docs", "seeds", "backend-1.md"), "utf-8").trimEnd();

(async () => {
  const { ag, account } = await getClient();
  console.log("deploying backend-1 (mint-only) as", account.address);
  console.log("seed length:", SEED.length, "chars");

  const r = await ag.agent.deploy({
    idempotencyKey: "backend-1-mint-001",
    name: "backend-1",
    description: "Backend developer for 0g-agentic-team toolchain (test deployment)",
    framework: "prime-agent",
    inference: { provider: "0g-compute", model: "glm-5.3" },
    iData: [
      { role: "framework", plaintext: { name: "prime-agent", schema_version: 1 }, extra: {} },
      { role: "persona", plaintext: {
          system_prompt: SEED,
          inference: { provider: "0g-compute", model: "glm-5.3" },
      }, extra: {} },
    ],
    // sandbox omitted → mint-only: mint the on-chain identity, do not provision a container (offline; provision at start())
  }, { wait: "minted", preflight: false });

  console.log("accepted:", JSON.stringify(r, (k, v) => typeof v === "bigint" ? v.toString() : v, 1));
})().catch(e => {
  console.error("ERR:", e.message.slice(0, 300));
  process.exit(1);
});
