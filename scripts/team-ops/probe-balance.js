// probe-balance.js — provider-side true balance (owner-signed envelope, via the TEE bridge)
const { getClient } = require("./team-init");

(async () => {
  const { ag, account } = await getClient();
  try {
    const b = await ag.getBalanceDetail ? await ag.getBalanceDetail() : null;
  } catch {}
  // is attestor.getEffectiveBalance exposed on the AgenticID facade? just probe both names
  for (const name of ["getEffectiveBalance", "getBalanceDetail"]) {
    if (typeof ag[name] === "function") {
      try {
        const r = await ag[name]();
        console.log(name + ":", JSON.stringify(r, (k, v) => typeof v === "bigint" ? v.toString() : v, 1));
      } catch (e) { console.log(name + " ERR:", e.message.slice(0, 200)); }
    } else {
      console.log(name + ": (not on facade)");
    }
  }
  // internal-path fallback: go straight through the attestor client
  const cfg = await fetch("https://agenticid-mainnet.0g.ai/config").then(r => r.json());
  console.log("sandbox_endpoint:", cfg.sandbox_endpoint);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
