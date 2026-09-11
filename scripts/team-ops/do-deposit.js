// do-deposit.js — native → prepaid 池（SandboxServing.deposit）
// 试点分配：2 OG 进池（backend-1 ~8h runtime + mint 门槛），余 ~1.1 OG 留 gas。
const { getClient } = require("./team-init");

(async () => {
  const { ag, account } = await getClient();
  const AMOUNT_WEI = 2n * 10n ** 18n;  // 2 OG
  console.log("depositing 2 OG from", account.address, "…");
  const tx = await ag.deposit({ amountWei: AMOUNT_WEI });
  console.log("tx:", tx);
  const rec = await ag.waitForTransaction(tx);
  console.log("receipt status:", rec.status, "| gasUsed:", rec.gasUsed.toString());
  const eff = await ag.getEffectiveBalance();
  console.log("provider available now:", Number(eff.availableWei) / 1e18, "OG");
})().catch(e => { console.error("ERR:", e.message.slice(0, 300)); process.exit(1); });
