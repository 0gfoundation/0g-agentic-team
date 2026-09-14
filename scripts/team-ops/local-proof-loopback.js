// local-proof-loopback.js — offline self-test of the §2 proof protocol
// (no network, no member): sign a body as lead, format as outbound message,
// parse it back with chat-member.js's parseProof logic, verify, and also test
// the failure paths (tampered body, unsigned).
const fs = require("node:fs");
const { verifyMessage } = require("viem");
const { getClient } = require("./team-init");

const PROOF_MARK = "--- proof ---";
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
  const body = lines.slice(0, mark).join("\n").replace(/\n+$/, "");
  return { body, signer, signature };
}

(async () => {
  const { account } = await getClient();
  console.log("lead seal:", account.address);

  // 1. happy path: sign → format → parse → verify
  const body = "Task: verify the loopback.\nMultiple lines, colons: like this, and 100% edge cases.";
  const sig = await account.signMessage({ message: body });
  const wire = `${body}\n\n${PROOF_MARK}\nsigner: ${account.address} (agentId 409)\nsignature: ${sig}`;
  const p = parseProof(wire);
  const ok1 = p && await verifyMessage({ address: account.address, message: p.body, signature: p.signature });
  console.log("1. happy path:", ok1 ? "PASS (sign→wire→parse→verify)" : "FAIL");

  // 2. tampered body must fail
  const ok2 = !await verifyMessage({ address: account.address, message: p.body + "tampered", signature: p.signature });
  console.log("2. tamper detection:", ok2 ? "PASS (tampered body fails)" : "FAIL");

  // 3. unsigned message → parseProof null
  const ok3 = parseProof("just a plain reply, no proof block") === null;
  console.log("3. unsigned detection:", ok3 ? "PASS (no proof block → null)" : "FAIL");

  // 4. trailing-newline leniency: sender added \n before proof mark
  const wire4 = `${body}\n\n\n${PROOF_MARK}\nsigner: ${account.address} (agentId 409)\nsignature: ${sig}`;
  const p4 = parseProof(wire4);
  let ok4 = false;
  for (const m of [p4.body, p4.body.replace(/\n$/, "")]) {
    try { if (await verifyMessage({ address: account.address, message: m, signature: p4.signature })) ok4 = true; } catch {}
  }
  console.log("4. trailing-newline leniency:", ok4 ? "PASS" : "FAIL");

  process.exit(ok1 && ok2 && ok3 && ok4 ? 0 : 5);
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
