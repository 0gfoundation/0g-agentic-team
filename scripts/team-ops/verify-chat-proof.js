// verify-chat-proof.js — end-to-end verification of a member chat response:
// does the chat response (through the member's public URL) carry a valid
// X-Agent-Proof that on-chain-verifies against the member's agentSeal?
// Usage: AGENTICID_NET=testnet node verify-chat-proof.js <agentId> [message]
const AGENT_ID_RAW = process.argv[2] || "410";
const MSG = process.argv[3] || "Reply with the single word PONG. Nothing else.";
if (!/^\d+$/.test(AGENT_ID_RAW)) { console.error("usage: node verify-chat-proof.js <agentId> [message]"); process.exit(1); }
const { getClient } = require("./team-init");

(async () => {
  const { ag } = await getClient();
  const c = await ag.agent.client(BigInt(AGENT_ID_RAW));

  // 1. Call chat with the client's raw fetch (NOT chatStream) so we keep the Response
  //    object and can read X-Agent-Proof off its headers.
  const chatRoute = c.routes.find((r) => r.kind === "chat");
  if (!chatRoute) throw new Error("no chat route declared by this agent");
  const path = `${chatRoute.prefix}chat/completions`;
  const t0 = Date.now();

  const res = await c.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: MSG }], stream: false }),
  });
  console.log(`[1] POST ${path} -> HTTP ${res.status} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // 2. Extract the proof from the response headers
  const header = res.headers.get("X-Agent-Proof");
  if (!header) throw new Error("no X-Agent-Proof header on chat response — chat does not transit the signed proxy");
  const proof = ag.parseServeProofHeader(header);
  console.log(`[2] proof extracted: agentId=${proof.agentId} submitter=${proof.submitter} deadline=${proof.deadline} dataHashes=${proof.dataHashes.length}`);

  // 3. Verify against chain
  const v = await ag.verifyProof(proof);
  console.log(`[3] verification: ok=${v.ok} signerMatches=${v.signerMatches} notExpired=${v.notExpired} dataOnChain=${v.dataOnChain}`);
  if (v.reasons.length) console.log("    reasons:", v.reasons.join("; "));

  // 4. The actual reply content
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content ?? "(empty)";
  console.log(`[4] reply (${text.length} chars): ${text.slice(0, 120)}`);

  console.log(v.ok ? "\nVERDICT: chat replies carry valid on-chain-verifiable proof — use this channel as-is." : "\nVERDICT: proof invalid — see reasons above.");
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
