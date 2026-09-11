// team-init.js — 端到端客户端（只读验证，零花费）
// 桥接说明：私钥永在 TEE；本脚本所有签名都经 seal socket，由 lead 自主起草。
// SDK 0.1.4 的 b64encode 优先用 globalThis.btoa，而 Node 的 btoa 对多字节字符
// （persona seed 含中文）抛 InvalidCharacterError。删掉它，让 SDK 走 Buffer 分支
// （正确 UTF-8 → base64）。viem 不依赖 globalThis.btoa。
delete globalThis.btoa;

const { makeTeeAccount } = require("./tee-account");
const { AgenticID, ZERO_G_MAINNET } = require("@0gfoundation/0g-agenticid-sdk");

async function getClient() {
  const account = makeTeeAccount();
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
    console.log("== client up ==");
    console.log("owner/treasury:", account.address);

    // 1) trust roots 状态（只读）
    const cs = await ag.components(account.address);
    for (const c of cs) {
      console.log(`component ${c.appId}: acked=${c.acked} v${c.ackVersion}`);
    }

    // 2) ack 汇总
    const st = await ag.ackStatus(account.address);
    console.log("ackStatus allAcked:", st.allAcked, "| missing:", st.missing);

    // 3) prepaid 余额（只读）
    const bal = await ag.getBalance();
    console.log("prepaid balance:", bal.toString(), "wei");

    // 4) 我的部署列表（只读）
    const deps = await ag.agent.listMyDeployments();
    console.log("deployments:", deps.length ? JSON.stringify(deps, null, 1).slice(0, 400) : "（无）");
  })().catch(e => { console.error("ERR:", e.message); process.exit(1); });
}
