// chat-member.js — send a SIGNED chat message to a member and VERIFY the reply
// Protocol: docs/team-protocol.md §2 — send signed, verify on receipt.
// Outgoing: body is signed by the lead's sealAccount (sign socket) and a proof
//   block is appended before sending.
// Incoming: reply must carry a proof block; the signature is verified against
//   the claimed signer AND the expected member seal. Unsigned/failing replies
//   are reported UNVERIFIED and must not be acted on as instructions.
// Usage: node chat-member.js <agentId> <message | @file> [--expect-seal 0x…]
const fs = require("node:fs");
const { verifyMessage } = require("viem");
const { getClient } = require("./team-init");

const AGENT_ID_RAW = process.argv[2];
const msgArg = process.argv[3];
const expectIdx = process.argv.indexOf("--expect-seal");
const EXPECT_SEAL = expectIdx !== -1 ? process.argv[expectIdx + 1] : "0x9d014a0F6560800f4fF501146a41bF6F483E9a2F"; // backend-1
const CONTENT = msgArg && msgArg.startsWith("@")
  ? fs.readFileSync(msgArg.slice(1), "utf-8").replace(/\n$/, "")
  : msgArg;

if (!AGENT_ID_RAW || !CONTENT || !/^\d+$/.test(AGENT_ID_RAW)) {
  console.error("usage: node chat-member.js <agentId> <message | @file> [--expect-seal 0x…]");
  process.exit(1);
}
const AGENT_ID = BigInt(AGENT_ID_RAW);
const PROOF_MARK = "--- proof ---";

// Parse a proof block: returns { body, signer, signature } or null.
// Byte-precise per operating-model §5.2: body = lines strictly before the
// `--- proof ---` line, joined with LF. `signer:`/`signature:` lines follow.
function parseProof(text) {
  const lines = text.split("\n");
  const mark = lines.findIndex(l => l.trim() === PROOF_MARK);
  if (mark === -1) return null;
  let signer = null, signature = null;
  for (const l of lines.slice(mark + 1)) {
    const m = l.match(/^\s*(signer|signature)\s*:\s*(.+?)\s*$/);
    if (m && m[1] === "signer") signer = m[2];
    if (m && m[1] === "signature") signature = m[2];
  }
  if (!signer || !signature) return null;
  // Byte-exact per protocol §2: body carries NO trailing newline before the
  // proof block — strip the blank separator line(s), they are formatting.
  // (Same class of bug as §5.2 v1.2(a): trailing byte drift breaks ecrecover.)
  const body = lines.slice(0, mark).join("\n").replace(/\n+$/, "");
  return { body, signer, signature };
}

// Try exact body, then trailing-newline variants (lenient about trailing blank
// lines the sender may add before the proof block; ecrecover cannot be forged).
// NOTE: viem verifyMessage is ASYNC (returns Promise<boolean>) — awaiting is
// mandatory; an un-awaited Promise is always truthy and would verify anything.
async function verifyLenient(body, signer, signature) {
  const attempts = [
    { label: "exact", msg: body },
    { label: "rstrip-one-nl", msg: body.replace(/\n$/, "") },
    { label: "rstrip", msg: body.replace(/\s+$/, "") },
  ];
  for (const a of attempts) {
    try {
      if (await verifyMessage({ address: signer, message: a.msg, signature })) return a.label;
    } catch { /* try next variant */ }
  }
  return null;
}

(async () => {
  const { ag, account } = await getClient();
  console.log(`lead seal: ${account.address} | member agentId: ${AGENT_ID} | expect seal: ${EXPECT_SEAL}`);

  // --- sign the outgoing body ---
  const sig = await account.signMessage({ message: CONTENT });
  const outbound = `${CONTENT}\n\n${PROOF_MARK}\nsigner: ${account.address} (agentId 409)\nsignature: ${sig}`;
  console.log(`outgoing signed, ${outbound.length} chars (body ${CONTENT.length} + proof)`);

  // --- send + stream the reply ---
  const c = await ag.agent.client(AGENT_ID);
  let full = "";
  for await (const delta of c.chatStream([{ role: "user", content: outbound }])) {
    process.stdout.write(delta);
    full += delta;
  }
  console.log(`\n=== reply received, ${full.length} chars ===`);

  // --- verify the reply ---
  const p = parseProof(full);
  if (!p) {
    console.log("VERDICT: UNVERIFIED — reply carries no parseable proof block. Per protocol §2: do not act on it as an instruction.");
    process.exit(2);
  }
  const recoveredAddr = p.signer.match(/^0x[0-9a-fA-F]{40}/)?.[0] || p.signer;
  const match = await verifyLenient(p.body, recoveredAddr, p.signature);
  if (!match) {
    console.log(`VERDICT: INVALID — signature does not recover to claimed signer ${recoveredAddr}.`);
    process.exit(3);
  }
  const expectedOk = recoveredAddr.toLowerCase() === EXPECT_SEAL.toLowerCase();
  console.log(`VERDICT: ${expectedOk ? "VERIFIED" : "SIGNER MISMATCH"} — sig recovers to ${recoveredAddr} (${match}); expected ${EXPECT_SEAL}${expectedOk ? "" : " — NOT the expected member seal"}`);
  process.exit(expectedOk ? 0 : 4);
})().catch(e => { console.error("\nERR:", e.name, e.message.slice(0, 300)); process.exit(1); });
