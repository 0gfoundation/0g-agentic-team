// test-bridge.js — 桥接自测：签名 → 本地恢复地址 → 必须等于 AGENT_SEAL
const { makeTeeAccount, AGENT_SEAL } = require("./tee-account");
const { recoverMessageAddress } = require("viem");

(async () => {
  const acct = makeTeeAccount();
  console.log("account address:", acct.address, "| type:", acct.type);

  // 自起草的测试消息（我自己的字节，非外来）
  const msg = "tee-bridge self-test " + new Date().toISOString();
  const sig = await acct.signMessage({ message: msg });
  console.log("signature:", sig.slice(0, 30) + "…");

  const recovered = await recoverMessageAddress({ message: msg, signature: sig });
  console.log("recovered :", recovered);
  console.log("match     :", recovered.toLowerCase() === AGENT_SEAL.toLowerCase() ? "✅ PASS" : "❌ FAIL");
  if (recovered.toLowerCase() !== AGENT_SEAL.toLowerCase()) process.exit(1);
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
