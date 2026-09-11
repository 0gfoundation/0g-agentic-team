// deploy-backend1.js — mint-only 铸造 backend-1（无 sandbox payload → 无容器、不扣 create fee）
// persona seed 从 docs/seeds/backend-1.md 读取（WYSIWYS：读入什么就密封什么）
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
    // sandbox 省略 → mint-only：链上铸造身份，不 provision 容器（offline，start() 时再上）
  }, { wait: "minted", preflight: false });

  console.log("accepted:", JSON.stringify(r, (k, v) => typeof v === "bigint" ? v.toString() : v, 1));
})().catch(e => {
  console.error("ERR:", e.message.slice(0, 300));
  process.exit(1);
});
