// team-init.js — 端到端客户端（只读验证，零花费）
// 官方 TEE 桥：sealAccount()（SDK /seal 子路径导出）——viem LocalAccount 直连
// sign socket，私钥永在 TEE。手搓桥（tee-account.js）仅留作对照。
delete globalThis.btoa; // SDK 0.1.4: Node btoa 对中文 seed 炸，走 Buffer 分支

const { AgenticID, ZERO_G_MAINNET } = require("@0gfoundation/0g-agenticid-sdk");
const { sealAccount } = require("@0gfoundation/0g-agenticid-sdk/seal");

async function getClient() {
  const account = await sealAccount();  // $SEAL_SIGN_SOCK + $AGENT_SEAL 自动探测
  const ag = await AgenticID.fromAttestor("https://agenticid-mainnet.0g.ai", {
    account,
    chain: ZERO_G_MAINNET,
  });
  return { ag, account };
}

module.exports = { getClient };

if (require.main === module) {
  (async () => {
    const { ag, account } = await getClient();
    console.log("== client up (sealAccount) ==");
    console.log("owner/treasury:", account.address, "| account.type:", account.type);

    const st = await ag.ackStatus(account.address);
    console.log("ackStatus allAcked:", st.allAcked, "| missing:", st.missing);

    const eff = await ag.getEffectiveBalance();
    console.log("provider available:", eff.availableWei, "wei");

    const deps = await ag.agent.listMyDeployments();
    console.log("deployments:", deps.length ? JSON.stringify(deps).slice(0, 300) : "（无）");
  })().catch(e => { console.error("ERR:", e.message); process.exit(1); });
}
