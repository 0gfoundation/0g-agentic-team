// tee-account.js — 手搓 TEE 桥（参考实现；生产用 SDK 官方 sealAccount()，见 team-init.js）
// 2026-09-11 实测：本实现也能跑通 ack/effective-balance/deploy envelope，但缺 viem
// toAccount() 的完整形状（source/sign/serializer hooks），复杂路径有隐患——勿扩展。
// 私钥永在 TEE；本模块只转发签名请求。所有调用方起草自己的动作字节。
const http = require("node:http");

const SEAL_SOCK = process.env.SEAL_SIGN_SOCK || "/run/seal-sign.sock";
const AGENT_SEAL = process.env.AGENT_SEAL;

function sealPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { socketPath: SEAL_SOCK, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(b) }); }
          catch { reject(new Error(`seal ${path} non-JSON: ${b.slice(0, 200)}`)); }
        });
      });
    req.on("error", reject);
    req.end(data);
  });
}

const hexOf = (v) => (typeof v === "bigint" ? "0x" + v.toString(16) : v);

function makeTeeAccount() {
  if (!AGENT_SEAL) throw new Error("AGENT_SEAL env not set");
  return {
    type: "local",  // viem 白名单要求 local/json-rpc；实际签名走 TEE 桥
    address: AGENT_SEAL,
    source: "sealed-runtime-sign-socket",

    async signMessage({ message }) {
      let body;
      if (typeof message === "string") {
        body = message.startsWith("0x")
          ? { message_hex: message }   // viem 有时把 raw hex 当 string 传
          : { message: message };
      } else if (message && message.raw) {
        const raw = typeof message.raw === "string" ? message.raw
          : "0x" + Buffer.from(message.raw).toString("hex");
        body = { message_hex: raw };
      } else throw new Error("unsupported message form: " + typeof message);
      const r = await sealPost("/sign/personal_sign", body);
      if (r.status !== 200 || !r.json.signature) throw new Error("personal_sign failed: " + JSON.stringify(r.json).slice(0, 200));
      return r.json.signature;
    },

    async signTypedData(typedData) {
      const r = await sealPost("/sign/typed_data", typedData);
      if (r.status !== 200 || !r.json.signature) throw new Error("typed_data failed: " + JSON.stringify(r.json).slice(0, 200));
      return r.json.signature;
    },

    async signTransaction(tx) {
      const r = await sealPost("/sign/transaction", {
        chain_id: String(tx.chainId ?? 16661),  // socket: string
        nonce: Number(tx.nonce),                 // socket: uint64
        to: tx.to,
        value: hexOf(tx.value ?? 0n),
        data: tx.data ?? "0x",
        gas_limit: tx.gas != null ? Number(tx.gas) : undefined,               // uint64
        max_fee_per_gas: tx.maxFeePerGas != null ? hexOf(tx.maxFeePerGas) : undefined,        // hex string
        max_priority_fee_per_gas: tx.maxPriorityFeePerGas != null ? hexOf(tx.maxPriorityFeePerGas) : undefined,
        type: "dynamic",
      });
      if (r.status !== 200 || !r.json.raw_tx) {
        throw new Error("transaction sign failed: HTTP " + r.status + " " +
          JSON.stringify(r.json).slice(0, 500));
      }
      return r.json.raw_tx;
    },
  };
}

module.exports = { makeTeeAccount, sealPost, AGENT_SEAL };
