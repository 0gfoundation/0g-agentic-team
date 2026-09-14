// verify-member.js — read-only: verify a member's on-chain identity and deployment state
// Usage: node verify-member.js <agentId>
// Safe to re-run any time (read path). Confirms: agentSeal mapping, NFT owner == treasury, phase.
const { getClient } = require("./team-init");

const AGENT_ID = BigInt(process.argv[2] || "410");

(async () => {
  const { ag, account } = await getClient();
  const sealAddr = await ag.agent.getAgentSeal(AGENT_ID);
  const nftOwner = await ag.agent.ownerOf(AGENT_ID);
  console.log(`agentId ${AGENT_ID} → agentSeal:`, sealAddr);
  console.log(`agentId ${AGENT_ID} → NFT owner:`, nftOwner, "| is treasury:", nftOwner === account.address);
  const deps = await ag.agent.listMyDeployments();
  console.log("deployments:", JSON.stringify(deps, (k, v) => typeof v === "bigint" ? v.toString() : v, 1));
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
