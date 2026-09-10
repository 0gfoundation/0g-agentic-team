# AgenticID 主网合约地图
**逆向侦察成果 · 2026-09-10 · 0G mainnet (chain 16661)**

## 代理架构（三层）

```
0x92f66386092883f738032c472424255362a2cc6d   入口代理 (592B, 硬编码 delegate)
  └─ delegatecall → 0x882fcd3c3b7b32eb53b11886b024cf656456f21c   UUPS 代理 (619B)
                      └─ implementation() → 0xaa63e6b6260402f9f0bfa9fe4df749d44c588817
                                              核心逻辑合约 (24,567B, 62 函数)
```

注：入口代理非标准 EIP-1967（implementation 存硬编码）；UUPS 层 slot 为零，
经 `implementation()` (0x5c60da1b) 调用取得 logic 地址。

## 已解析函数（46/62，openchain 签名库）

### Agent 注册 / ERC-721 主体
| selector | 函数 | 说明 |
|---|---|---|
| 0x1aa3a008 | `register()` | 无参注册 |
| 0xf2c298be | `register(string)` | 带名注册 |
| 0x8ea42286 | `register(string,(string,bytes)[])` | 带名+iData 注册 |
| 0x6352211e | `ownerOf(uint256)` | NFT owner |
| 0x70a08231 | `balanceOf(address)` | 持有数 |
| 0x23b872dd / 0x42842e0e / 0xb88d4fde | `transferFrom` / `safeTransferFrom` ×2 | 转让 |
| 0x06fdde03 / 0x95d89b41 / 0xc87b56dd | `name` / `symbol` / `tokenURI` | 元数据 |
| 0x150b7a02 | `onERC721Received` | 接收回调 |
| 0x095ea7b3 / 0x081812fc / 0xa22cb465 / 0xe985e9c5 | approve 系 | 授权 |

### iData / 元数据锚定
| selector | 函数 | 说明 |
|---|---|---|
| 0x466648da | `setMetadata(uint256,string,bytes)` | KV 元数据 |
| 0xcb4799f2 | `getMetadata(uint256,string)` | 读取 |
| 0x0af28bd3 | `setAgentURI(uint256,string)` | agent URI（0G Storage 指针）|
| 0x40fbd72f | `intelligentDatasOf(uint256)` | iData 列表 |

### 钱包绑定
| selector | 函数 | 说明 |
|---|---|---|
| 0x2d1ef5ae | `setAgentWallet(uint256,address,uint256,bytes)` | 绑定操作钱包（带签名验证）|
| 0x3fddcf19 | `unsetAgentWallet(uint256)` | 解绑 |

### Attestor 信任网络
| selector | 函数 | 说明 |
|---|---|---|
| 0xe430970d / 0x4159c83f | `addTrustedAttestor` / `removeTrustedAttestor` | 信任管理 |
| 0xca8f2ccd | `isTrustedAttestor(address)` | 查询 |
| 0x5437988d / 0x2b7ac3f3 | `setVerifier` / `verifier()` | 验证者 |
| 0x84b0196e | `eip712Domain()` | EIP-712 域分隔 |

### 使用授权（经济层）
| selector | 函数 | 说明 |
|---|---|---|
| 0xfa83d14e | `authorizeUsage(uint256,address)` | 授权使用者 |
| 0xf30c6a0c | `batchAuthorizeUsage(uint256,address[])` | 批量 |
| 0xc3612ef7 | `revokeAuthorization(uint256,address)` | 撤销 |
| 0x1aeb542f / 0x0f5cbc03 | `authorizedUsersOf` / `clearAuthorizedUsers` | 查询/清空 |
| 0xa5cf3d18 | `MAX_AUTHORIZED_USERS()` | 上限 |

### 治理 / 安全
| selector | 函数 | 说明 |
|---|---|---|
| 0xe56f2fe4 | `initialize(string,string,address,address,address,address)` | 代理初始化 |
| 0x8456cb59 / 0x3f4ba83a / 0x5c975abb / 0x9fd0506d / 0x2d88af4a | pause 系 | 紧急制动 |
| 0x8da5cb5b / 0xf2fde38b / 0x715018a6 | Ownable 系 | 所有权 |
| 0x01ffc9a7 | `supportsInterface` | ERC-165 |
| 0xffa1ad74 / 0x26afaadd | `VERSION()` / `canonical()` | 版本/规范地址 |

## 未解析 selector（16 个，公共签名库未收录 → 逆向待办）

`0x01812e1a 0x11d06a5e 0x29cc20e5 0x4ec5d962 0x732fea42 0x74f8628b 0x76381ef1
0x7912ede0 0x8d99dd1f 0xb4786f37 0xc7a2850c 0xd63e965f 0xe86be0e2 0xf3040317
0xf6ef1f84 0xff72b115`

（疑似 update/attestation/reputation 相关——lead 的 A 线任务卡候选）

## 关键链下组件（attestor GET /config，2026-09-10）

| 组件 | 地址/端点 |
|---|---|
| attestor | https://agenticid-mainnet.0g.ai |
| RPC | https://evmrpc.0g.ai |
| SandboxServing（计费）| 0x650c16a491ad52db6b7f3053bcad650cb43d2206 |
| sandbox provider | 0x7bad25f801530fcce03417417239332777ee9ad0 |
| TappRegistry | 0x54874f536301c993922dd95097e3902e7fbfe612 |
| VerifiedFeedback | 0x666391a61f3980bf942ce8c3cc8dfd7f2f7b2f4c |
| CloneGate | 0x1d33086b367a9df4b4f4d7a29b35fc1187380303 |

定价（services() 实读）：CPU 0.001 OG/min · 内存 0.0005 OG/GB/min · 创建费 0.01 OG

## 逆向方法备忘

- solc ≥0.8 dispatcher 提取正则：`63([0-9a-f]{8})14[612][0-9a-f]{0,6}57`
- 4byte.directory 有错误条目（`services(address)` 曾返回错 selector）；签名库以 openchain 为准，selector 以本地 keccak 实算为准
