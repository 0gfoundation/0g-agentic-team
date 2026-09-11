// probe-balance.js — provider 真实余额（owner-signed envelope，经 TEE 桥）
const { getClient } = require("./team-init");

(async () => {
  const { ag, account } = await getClient();
  try {
    const b = await ag.getBalanceDetail ? await ag.getBalanceDetail() : null;
  } catch {}
  // attestor.getEffectiveBalance 暴露在 AgenticID 上吗？直接试两个名字
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
  // 内部路径兜底：直接走 attestor client
  const cfg = await fetch("https://agenticid-mainnet.0g.ai/config").then(r => r.json());
  console.log("sandbox_endpoint:", cfg.sandbox_endpoint);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
