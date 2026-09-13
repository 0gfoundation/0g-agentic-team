// team-init.js — end-to-end client (read-only verification, zero spend)
// Official TEE bridge: sealAccount() (exported from the SDK /seal subpath) — a viem LocalAccount
// wired directly to the sign socket; the private key never leaves the TEE.
// The hand-rolled bridge (tee-account.js) is kept for reference only.
delete globalThis.btoa; // SDK 0.1.4: Node's btoa chokes on CJK seeds — take the Buffer branch

const { AgenticID, ZERO_G_MAINNET } = require("@0gfoundation/0g-agenticid-sdk");
const { sealAccount } = require("@0gfoundation/0g-agenticid-sdk/seal");

async function getClient() {
  const account = await sealAccount();  // $SEAL_SIGN_SOCK + $AGENT_SEAL auto-detected
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
    console.log("deployments:", deps.length ? JSON.stringify(deps).slice(0, 300) : "(none)");
  })().catch(e => { console.error("ERR:", e.message); process.exit(1); });
}
