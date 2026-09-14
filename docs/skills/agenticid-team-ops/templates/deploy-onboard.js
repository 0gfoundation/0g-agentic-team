// deploy-onboard.js — mint-only deploy of a fresh member (no container, zero billing until start())
// Usage: node deploy-onboard.js [seedPath] [idempotencyKey] [name]
// WYSIWYS: what gets read in is what gets sealed — the persona seed is injected verbatim.
// CHANGE the idempotencyKey per member. Re-running with the same key is the idempotency guard,
// but a different key mints a SECOND member (orphan) — never re-run to "verify".
const fs = require("node:fs");
const path = require("node:path");
const { getClient } = require("./team-init");

const SEED_PATH = process.argv[2] || path.join(__dirname, "..", "..", "docs", "seeds", "backend-1.md");
const IDEMPOTENCY_KEY = process.argv[3] || "onboard-member-001";
const NAME = process.argv[4] || "backend-1";

const SEED = fs.readFileSync(SEED_PATH, "utf-8").trimEnd();

(async () => {
  const { ag, account } = await getClient();
  console.log("mint-only deploy as", account.address, "→", NAME);
  console.log("seed:", SEED_PATH, "| length:", SEED.length, "chars");

  const r = await ag.agent.deploy({
    idempotencyKey: IDEMPOTENCY_KEY,
    name: NAME,
    description: "Member of 0g-agentic-team (testnet onboard exercise)",
    framework: "prime-agent",
    inference: { provider: "0g-compute", model: "glm-5.3" },
    iData: [
      { role: "framework", plaintext: { name: "prime-agent", schema_version: 1 }, extra: {} },
      { role: "persona", plaintext: {
          system_prompt: SEED,
          inference: { provider: "0g-compute", model: "glm-5.3" },
      }, extra: {} },
    ],
    // sandbox omitted → mint-only: on-chain identity only; provision at start-member.js
  }, { wait: "minted", preflight: false });

  console.log("accepted:", JSON.stringify(r, (k, v) => typeof v === "bigint" ? v.toString() : v, 1));
})().catch(e => {
  console.error("ERR:", e.message.slice(0, 400));
  process.exit(1);
});
