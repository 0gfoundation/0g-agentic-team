# AgenticID Mainnet Contract Map
**Reverse-engineering recon · 2026-09-10 · 0G mainnet (chain 16661)**

## Proxy architecture (three layers)

```
0x92f66386092883f738032c472424255362a2cc6d   entry proxy (592B, hardcoded delegate)
  └─ delegatecall → 0x882fcd3c3b7b32eb53b11886b024cf656456f21c   UUPS proxy (619B)
                      └─ implementation() → 0xaa63e6b6260402f9f0bfa9fe4df749d44c588817
                                              core logic contract (24,567B, 62 functions)
```

Note: the entry proxy is non-standard EIP-1967 (the implementation address is hardcoded);
the UUPS layer's slot is zero — the logic address is obtained via the `implementation()` call (0x5c60da1b).

## Resolved functions (46/62, openchain signature database)

### Agent registration / ERC-7857 core (ERC-721-compatible interface)
| selector | function | notes |
|---|---|---|
| 0x1aa3a008 | `register()` | parameterless registration |
| 0xf2c298be | `register(string)` | register with name |
| 0x8ea42286 | `register(string,(string,bytes)[])` | register with name + iData |
| 0x6352211e | `ownerOf(uint256)` | NFT owner |
| 0x70a08231 | `balanceOf(address)` | holdings count |
| 0x23b872dd / 0x42842e0e / 0xb88d4fde | `transferFrom` / `safeTransferFrom` ×2 | transfers |
| 0x06fdde03 / 0x95d89b41 / 0xc87b56dd | `name` / `symbol` / `tokenURI` | metadata |
| 0x150b7a02 | `onERC721Received` | receive callback (7857 keeps the 721 interface) |
| 0x095ea7b3 / 0x081812fc / 0xa22cb465 / 0xe985e9c5 | approve family | approvals |

### iData / metadata anchoring
| selector | function | notes |
|---|---|---|
| 0x466648da | `setMetadata(uint256,string,bytes)` | KV metadata |
| 0xcb4799f2 | `getMetadata(uint256,string)` | read |
| 0x0af28bd3 | `setAgentURI(uint256,string)` | agent URI (0G Storage pointer) |
| 0x40fbd72f | `intelligentDatasOf(uint256)` | iData list |

### Wallet binding
| selector | function | notes |
|---|---|---|
| 0x2d1ef5ae | `setAgentWallet(uint256,address,uint256,bytes)` | bind an operational wallet (with signature check) |
| 0x3fddcf19 | `unsetAgentWallet(uint256)` | unbind |

### Attestor trust network
| selector | function | notes |
|---|---|---|
| 0xe430970d / 0x4159c83f | `addTrustedAttestor` / `removeTrustedAttestor` | trust management |
| 0xca8f2ccd | `isTrustedAttestor(address)` | query |
| 0x5437988d / 0x2b7ac3f3 | `setVerifier` / `verifier()` | verifier |
| 0x84b0196e | `eip712Domain()` | EIP-712 domain separator |

### Usage authorization (economic layer)
| selector | function | notes |
|---|---|---|
| 0xfa83d14e | `authorizeUsage(uint256,address)` | authorize a user |
| 0xf30c6a0c | `batchAuthorizeUsage(uint256,address[])` | batch |
| 0xc3612ef7 | `revokeAuthorization(uint256,address)` | revoke |
| 0x1aeb542f / 0x0f5cbc03 | `authorizedUsersOf` / `clearAuthorizedUsers` | query / clear |
| 0xa5cf3d18 | `MAX_AUTHORIZED_USERS()` | cap |

### Governance / security
| selector | function | notes |
|---|---|---|
| 0xe56f2fe4 | `initialize(string,string,address,address,address,address)` | proxy init |
| 0x8456cb59 / 0x3f4ba83a / 0x5c975abb / 0x9fd0506d / 0x2d88af4a | pause family | emergency brake |
| 0x8da5cb5b / 0xf2fde38b / 0x715018a6 | Ownable family | ownership |
| 0x01ffc9a7 | `supportsInterface` | ERC-165 |
| 0xffa1ad74 / 0x26afaadd | `VERSION()` / `canonical()` | version / canonical address |

## Unresolved selectors (16; absent from public signature databases → reverse-engineering backlog)

`0x01812e1a 0x11d06a5e 0x29cc20e5 0x4ec5d962 0x732fea42 0x74f8628b 0x76381ef1
0x7912ede0 0x8d99dd1f 0xb4786f37 0xc7a2850c 0xd63e965f 0xe86be0e2 0xf3040317
0xf6ef1f84 0xff72b115`

(probably update/attestation/reputation related — candidate task cards for the lead's workstream A)

## Key off-chain components (attestor GET /config, 2026-09-10)

| Component | Address / endpoint |
|---|---|
| attestor | https://agenticid-mainnet.0g.ai |
| RPC | https://evmrpc.0g.ai |
| SandboxServing (billing) | 0x650c16a491ad52db6b7f3053bcad650cb43d2206 |
| sandbox provider | 0x7bad25f801530fcce03417417239332777ee9ad0 |
| TappRegistry | 0x54874f536301c993922dd95097e3902e7fbfe612 |
| VerifiedFeedback | 0x666391a61f3980bf942ce8c3cc8dfd7f2f7b2f4c |
| CloneGate | 0x1d33086b367a9df4b4f4d7a29b35fc1187380303 |

Pricing (live read of `services()`): CPU 0.001 OG/min · memory 0.0005 OG/GB/min · creation fee 0.01 OG; standard tier 2CPU+4GB → 0.004 OG/min

## Reverse-engineering method notes

- solc ≥0.8 dispatcher extraction regex: `63([0-9a-f]{8})14[612][0-9a-f]{0,6}57`
- 4byte.directory has wrong entries (`services(address)` once returned a wrong selector); use openchain for signatures, and verify selectors against locally computed keccak
