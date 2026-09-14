// verify-proof.js — standalone verification of an agentSeal EIP-191 proof
const { verifyMessage } = require("viem");
const [,, addr, msgFile, sig] = process.argv;
const fs = require("node:fs");
const msg = fs.readFileSync(msgFile, "utf-8");
verifyMessage({ address: addr, message: msg, signature: sig })
  .then(ok => { console.log(ok ? "VALID ✓ recover ==" + addr : "INVALID ✗"); process.exit(ok ? 0 : 1); });
