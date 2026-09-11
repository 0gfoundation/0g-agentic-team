// do-ack.js — 一次性 trust-root 确认（建队前置，链上交易，花 gas）
const { getClient } = require("./team-init");

(async () => {
  const { ag, account } = await getClient();
  console.log("acking trust roots for", account.address, "…");
  const r = await ag.ack();
  if (r === null) { console.log("already acked, nothing to do"); return; }
  console.log("tx:", r);  // WriteContractReturnType: hash
  const receipt = await ag.waitForTransaction(r);
  console.log("receipt status:", receipt.status, "| block:", receipt.blockNumber);
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
