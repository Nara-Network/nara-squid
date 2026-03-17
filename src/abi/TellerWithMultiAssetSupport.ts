import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AccessControlModeUpdated: event("0xb8de0a8cda9c21ae9d2261ded3b241270440fa52dabf5b8c1e513e6b40ca8a67", "AccessControlModeUpdated(uint8,uint8)", {"oldMode": p.uint8, "newMode": p.uint8}),
    AssetAdded: event("0x0e3c58ebfb2e7465fbb1c32e6b4f40c3c4f5ca77e8218a386aff8617831260d7", "AssetAdded(address)", {"asset": indexed(p.address)}),
    AssetRemoved: event("0x37803e2125c48ee96c38ddf04e826daf335b0e1603579040fd275aba6d06b6fc", "AssetRemoved(address)", {"asset": indexed(p.address)}),
    AuthorityUpdated: event("0xa3396fd7f6e0a21b50e5089d2da70d5ac0a3bbbd1f617a93f134b76389980198", "AuthorityUpdated(address,address)", {"user": indexed(p.address), "newAuthority": indexed(p.address)}),
    BulkDeposit: event("0x6f9b974223f85a1ae805c33b8b519039e2435481d949db1110de151a94d587af", "BulkDeposit(address,uint256)", {"asset": indexed(p.address), "_depositAmount": p.uint256}),
    BulkWithdraw: event("0xdcc60b41ff1c604459e6aa4a7299817416b19fc586a392f111646e26597c4af9", "BulkWithdraw(address,uint256)", {"asset": indexed(p.address), "_shareAmount": p.uint256}),
    ChainAdded: event("0x92ca48f4323e5539c637c7a03bd3e43941aa078e4f165e1d02c7e309317c429c", "ChainAdded(uint256,bool,bool,address,uint64,uint64)", {"chainSelector": p.uint256, "allowMessagesFrom": p.bool, "allowMessagesTo": p.bool, "targetTeller": p.address, "messageGasLimit": p.uint64, "messageGasMin": p.uint64}),
    ChainAllowMessagesFrom: event("0xe925de263dcdbdc20307c9ab92758ed8cc0edf3d173dad4a3aa54c070f27a543", "ChainAllowMessagesFrom(uint256,address)", {"chainSelector": p.uint256, "targetTeller": p.address}),
    ChainAllowMessagesTo: event("0x34fe916485e02ec88e487b0e611e5c9bacabba9e3eaae7a900aa08be8197d419", "ChainAllowMessagesTo(uint256,address)", {"chainSelector": p.uint256, "targetTeller": p.address}),
    ChainRemoved: event("0x11a9d1a77f76361ed131c19b1dc5758504c51dbde2e49fc973a0ef9577ad13d5", "ChainRemoved(uint256)", {"chainSelector": p.uint256}),
    ChainSetGasLimit: event("0x53d0cf6aa4c6d5098568da88caa5cbffc1601722f79a7a01d6611d19d6046d2b", "ChainSetGasLimit(uint256,uint64)", {"chainSelector": p.uint256, "messageGasLimit": p.uint64}),
    ChainStopMessagesFrom: event("0x1cb867ed6a020e020ea220d4f48bb8e36552abf9095e093e377d33933f2b31e4", "ChainStopMessagesFrom(uint256)", {"chainSelector": p.uint256}),
    ChainStopMessagesTo: event("0xc45af64a13a09ef916a1114c59589294ec9c3095f2bfbbb093a7a96656858ded", "ChainStopMessagesTo(uint256)", {"chainSelector": p.uint256}),
    ContractWhitelistUpdated: event("0x75c4a453892342445f30810ef4163253a127a81c39d7ddfd519e996ff085c491", "ContractWhitelistUpdated(address,bool)", {"account": indexed(p.address), "status": p.bool}),
    Deposit: event("0xe96d7872363f475d18b2f5390caaa5eaa96b2d38e42c62afe4ac08ebd2b13c3a", "Deposit(uint256,address,address,uint256,uint256,uint256,uint256)", {"nonce": indexed(p.uint256), "receiver": indexed(p.address), "_depositAsset": indexed(p.address), "_depositAmount": p.uint256, "_shareAmount": p.uint256, "depositTimestamp": p.uint256, "shareLockPeriodAtTimeOfDeposit": p.uint256}),
    DepositCapUpdated: event("0xfbe912fdd0185617e8cafd12d97b59175b90e15f5c629faf6413469af54ee080", "DepositCapUpdated(uint256,uint256)", {"oldCap": p.uint256, "newCap": p.uint256}),
    DepositRefunded: event("0xaf98ea774275cadfa3e477a7b52cba03e01197445a76bd5d0d561608708c3624", "DepositRefunded(uint256,bytes32,address)", {"nonce": indexed(p.uint256), "depositHash": p.bytes32, "user": indexed(p.address)}),
    KeyringConfigUpdated: event("0xdd311e842d0dd0d276250faf64c7c9bed12bf94d1e4c1e33b304102684994fc8", "KeyringConfigUpdated(address,uint256)", {"keyringContract": p.address, "policyId": p.uint256}),
    ManualWhitelistUpdated: event("0xbe87d514b3e161103a7c1ddd4c9f1f4a93559090d347b432e657a09fc47f8e0b", "ManualWhitelistUpdated(address,bool)", {"account": indexed(p.address), "status": p.bool}),
    MessageReceived: event("0xb944fddc61d7fedb8b736790454ba972000703b0d21c7481d6dbf95b7c2cc2f1", "MessageReceived(bytes32,uint256,address)", {"messageId": p.bytes32, "shareAmount": p.uint256, "to": p.address}),
    MessageSent: event("0xe0ec62d39b054dc2fd626dbc271483735df6e6fa1ef8389754bf8ab27a75eab2", "MessageSent(bytes32,uint256,address)", {"messageId": p.bytes32, "shareAmount": p.uint256, "to": p.address}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"user": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x9e87fac88ff661f02d44f95383c817fece4bce600a3dab7a54406878b965e752", "Paused()", {}),
    PeerSet: event("0x238399d427b947898edb290f5ff0f9109849b1c3ba196a42e35f00c50a54b98b", "PeerSet(uint32,bytes32)", {"eid": p.uint32, "peer": p.bytes32}),
    ShareLockPeriodUpdated: event("0x29fb89878328cdeff99ebae571aca5dd957a58ba179596359c1b0d4440673b67", "ShareLockPeriodUpdated(uint64,uint64)", {"oldPeriod": p.uint64, "newPeriod": p.uint64}),
    Unpaused: event("0xa45f47fdea8a1efdd9029a5691c7f759c32b7c698632b563573e155625d16933", "Unpaused()", {}),
}

export const functions = {
    accessControlMode: viewFun("0xe11484c0", "accessControlMode()", {}, p.uint8),
    accountant: viewFun("0x4fb3ccc5", "accountant()", {}, p.address),
    addAsset: fun("0x298410e5", "addAsset(address)", {"_asset": p.address}, ),
    addChain: fun("0x7bb4122e", "addChain(uint32,bool,bool,address,uint64,uint64)", {"chainSelector": p.uint32, "allowMessagesFrom": p.bool, "allowMessagesTo": p.bool, "targetTeller": p.address, "messageGasLimit": p.uint64, "messageGasMin": p.uint64}, ),
    allowInitializePath: viewFun("0xff7bd03d", "allowInitializePath((uint32,bytes32,uint64))", {"origin": p.struct({"srcEid": p.uint32, "sender": p.bytes32, "nonce": p.uint64})}, p.bool),
    allowMessagesFromChain: fun("0x202eac57", "allowMessagesFromChain(uint32,address)", {"chainSelector": p.uint32, "targetTeller": p.address}, ),
    allowMessagesToChain: fun("0xe3298208", "allowMessagesToChain(uint32,address,uint64)", {"chainSelector": p.uint32, "targetTeller": p.address, "messageGasLimit": p.uint64}, ),
    authority: viewFun("0xbf7e214f", "authority()", {}, p.address),
    beforeTransfer: viewFun("0xe83931af", "beforeTransfer(address)", {"_from": p.address}, ),
    bridge: fun("0xa69559d1", "bridge(uint256,(uint32,address,address,uint64,bytes))", {"shareAmount": p.uint256, "data": p.struct({"chainSelector": p.uint32, "destinationChainReceiver": p.address, "bridgeFeeToken": p.address, "messageGas": p.uint64, "data": p.bytes})}, p.bytes32),
    bulkDeposit: fun("0x9d574420", "bulkDeposit(address,uint256,uint256,address)", {"_depositAsset": p.address, "_depositAmount": p.uint256, "_minimumMint": p.uint256, "_to": p.address}, p.uint256),
    bulkWithdraw: fun("0x3e64ce99", "bulkWithdraw(address,uint256,uint256,address)", {"_withdrawAsset": p.address, "_shareAmount": p.uint256, "_minimumAssets": p.uint256, "_to": p.address}, p.uint256),
    contractWhitelist: viewFun("0x4c999f5e", "contractWhitelist(address)", {"_0": p.address}, p.bool),
    deposit: fun("0x0efe6a8b", "deposit(address,uint256,uint256)", {"_depositAsset": p.address, "_depositAmount": p.uint256, "_minimumMint": p.uint256}, p.uint256),
    depositAndBridge: fun("0xbfe1a0f2", "depositAndBridge(address,uint256,uint256,(uint32,address,address,uint64,bytes))", {"depositAsset": p.address, "depositAmount": p.uint256, "minimumMint": p.uint256, "data": p.struct({"chainSelector": p.uint32, "destinationChainReceiver": p.address, "bridgeFeeToken": p.address, "messageGas": p.uint64, "data": p.bytes})}, ),
    depositCap: viewFun("0xdbd5edc7", "depositCap()", {}, p.uint256),
    depositNonce: viewFun("0xde35f5cb", "depositNonce()", {}, p.uint96),
    depositWithPermit: fun("0x3d935d9e", "depositWithPermit(address,uint256,uint256,uint256,uint8,bytes32,bytes32)", {"_depositAsset": p.address, "_depositAmount": p.uint256, "_minimumMint": p.uint256, "_deadline": p.uint256, "_v": p.uint8, "_r": p.bytes32, "_s": p.bytes32}, p.uint256),
    endpoint: viewFun("0x5e280f11", "endpoint()", {}, p.address),
    isComposeMsgSender: viewFun("0x82413eac", "isComposeMsgSender((uint32,bytes32,uint64),bytes,address)", {"_0": p.struct({"srcEid": p.uint32, "sender": p.bytes32, "nonce": p.uint64}), "_1": p.bytes, "_sender": p.address}, p.bool),
    isPaused: viewFun("0xb187bd26", "isPaused()", {}, p.bool),
    isSupported: viewFun("0x4f129c53", "isSupported(address)", {"_0": p.address}, p.bool),
    keyringContract: viewFun("0xf11a8ca5", "keyringContract()", {}, p.address),
    keyringPolicyId: viewFun("0xd636b05f", "keyringPolicyId()", {}, p.uint256),
    lzReceive: fun("0x13137d65", "lzReceive((uint32,bytes32,uint64),bytes32,bytes,address,bytes)", {"_origin": p.struct({"srcEid": p.uint32, "sender": p.bytes32, "nonce": p.uint64}), "_guid": p.bytes32, "_message": p.bytes, "_executor": p.address, "_extraData": p.bytes}, ),
    manualWhitelist: viewFun("0xd9e9c978", "manualWhitelist(address)", {"_0": p.address}, p.bool),
    nextNonce: viewFun("0x7d25a05e", "nextNonce(uint32,bytes32)", {"_0": p.uint32, "_1": p.bytes32}, p.uint64),
    oAppVersion: viewFun("0x17442b70", "oAppVersion()", {}, {"senderVersion": p.uint64, "receiverVersion": p.uint64}),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    peers: viewFun("0xbb0b6a53", "peers(uint32)", {"eid": p.uint32}, p.bytes32),
    previewFee: viewFun("0xffc19a01", "previewFee(uint256,(uint32,address,address,uint64,bytes))", {"shareAmount": p.uint256, "data": p.struct({"chainSelector": p.uint32, "destinationChainReceiver": p.address, "bridgeFeeToken": p.address, "messageGas": p.uint64, "data": p.bytes})}, p.uint256),
    publicDepositHistory: viewFun("0x9a94d3d0", "publicDepositHistory(uint256)", {"_0": p.uint256}, p.bytes32),
    refundDeposit: fun("0x46b563f4", "refundDeposit(uint256,address,address,uint256,uint256,uint256,uint256)", {"_nonce": p.uint256, "_receiver": p.address, "_depositAsset": p.address, "_depositAmount": p.uint256, "_shareAmount": p.uint256, "_depositTimestamp": p.uint256, "_shareLockUpPeriodAtTimeOfDeposit": p.uint256}, ),
    removeAsset: fun("0x4a5e42b1", "removeAsset(address)", {"_asset": p.address}, ),
    removeChain: fun("0x55a2d64d", "removeChain(uint32)", {"chainSelector": p.uint32}, ),
    selectorToChains: viewFun("0x3d4bd6fe", "selectorToChains(uint32)", {"_0": p.uint32}, {"allowMessagesFrom": p.bool, "allowMessagesTo": p.bool, "targetTeller": p.address, "messageGasLimit": p.uint64, "minimumMessageGas": p.uint64}),
    setAccessControlMode: fun("0x287fc825", "setAccessControlMode(uint8)", {"_mode": p.uint8}, ),
    setAuthority: fun("0x7a9e5e4b", "setAuthority(address)", {"newAuthority": p.address}, ),
    setChainGasLimit: fun("0x2264e930", "setChainGasLimit(uint32,uint64)", {"chainSelector": p.uint32, "messageGasLimit": p.uint64}, ),
    setDelegate: fun("0xca5eb5e1", "setDelegate(address)", {"_delegate": p.address}, ),
    setDepositCap: fun("0x86651203", "setDepositCap(uint256)", {"_depositCap": p.uint256}, ),
    setKeyringConfig: fun("0xbd0d9cbd", "setKeyringConfig(address,uint256)", {"_keyringContract": p.address, "_policyId": p.uint256}, ),
    setPeer: fun("0x3400288b", "setPeer(uint32,bytes32)", {"_eid": p.uint32, "_peer": p.bytes32}, ),
    setShareLockPeriod: fun("0x12056e2d", "setShareLockPeriod(uint64)", {"_shareLockPeriod": p.uint64}, ),
    shareLockPeriod: viewFun("0x9fdb11b6", "shareLockPeriod()", {}, p.uint64),
    shareUnlockTime: viewFun("0x1899ea81", "shareUnlockTime(address)", {"_0": p.address}, p.uint256),
    stopMessagesFromChain: fun("0xd555f368", "stopMessagesFromChain(uint32)", {"chainSelector": p.uint32}, ),
    stopMessagesToChain: fun("0x45ad6063", "stopMessagesToChain(uint32)", {"chainSelector": p.uint32}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    updateContractWhitelist: fun("0x3c5722c9", "updateContractWhitelist(address[],bool)", {"_addresses": p.array(p.address), "_status": p.bool}, ),
    updateManualWhitelist: fun("0xdbab77b6", "updateManualWhitelist(address[],bool)", {"_addresses": p.array(p.address), "_status": p.bool}, ),
    vault: viewFun("0xfbfa77cf", "vault()", {}, p.address),
}

export class Contract extends ContractBase {

    accessControlMode() {
        return this.eth_call(functions.accessControlMode, {})
    }

    accountant() {
        return this.eth_call(functions.accountant, {})
    }

    allowInitializePath(origin: AllowInitializePathParams["origin"]) {
        return this.eth_call(functions.allowInitializePath, {origin})
    }

    authority() {
        return this.eth_call(functions.authority, {})
    }

    contractWhitelist(_0: ContractWhitelistParams["_0"]) {
        return this.eth_call(functions.contractWhitelist, {_0})
    }

    depositCap() {
        return this.eth_call(functions.depositCap, {})
    }

    depositNonce() {
        return this.eth_call(functions.depositNonce, {})
    }

    endpoint() {
        return this.eth_call(functions.endpoint, {})
    }

    isComposeMsgSender(_0: IsComposeMsgSenderParams["_0"], _1: IsComposeMsgSenderParams["_1"], _sender: IsComposeMsgSenderParams["_sender"]) {
        return this.eth_call(functions.isComposeMsgSender, {_0, _1, _sender})
    }

    isPaused() {
        return this.eth_call(functions.isPaused, {})
    }

    isSupported(_0: IsSupportedParams["_0"]) {
        return this.eth_call(functions.isSupported, {_0})
    }

    keyringContract() {
        return this.eth_call(functions.keyringContract, {})
    }

    keyringPolicyId() {
        return this.eth_call(functions.keyringPolicyId, {})
    }

    manualWhitelist(_0: ManualWhitelistParams["_0"]) {
        return this.eth_call(functions.manualWhitelist, {_0})
    }

    nextNonce(_0: NextNonceParams["_0"], _1: NextNonceParams["_1"]) {
        return this.eth_call(functions.nextNonce, {_0, _1})
    }

    oAppVersion() {
        return this.eth_call(functions.oAppVersion, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    peers(eid: PeersParams["eid"]) {
        return this.eth_call(functions.peers, {eid})
    }

    previewFee(shareAmount: PreviewFeeParams["shareAmount"], data: PreviewFeeParams["data"]) {
        return this.eth_call(functions.previewFee, {shareAmount, data})
    }

    publicDepositHistory(_0: PublicDepositHistoryParams["_0"]) {
        return this.eth_call(functions.publicDepositHistory, {_0})
    }

    selectorToChains(_0: SelectorToChainsParams["_0"]) {
        return this.eth_call(functions.selectorToChains, {_0})
    }

    shareLockPeriod() {
        return this.eth_call(functions.shareLockPeriod, {})
    }

    shareUnlockTime(_0: ShareUnlockTimeParams["_0"]) {
        return this.eth_call(functions.shareUnlockTime, {_0})
    }

    vault() {
        return this.eth_call(functions.vault, {})
    }
}

/// Event types
export type AccessControlModeUpdatedEventArgs = EParams<typeof events.AccessControlModeUpdated>
export type AssetAddedEventArgs = EParams<typeof events.AssetAdded>
export type AssetRemovedEventArgs = EParams<typeof events.AssetRemoved>
export type AuthorityUpdatedEventArgs = EParams<typeof events.AuthorityUpdated>
export type BulkDepositEventArgs = EParams<typeof events.BulkDeposit>
export type BulkWithdrawEventArgs = EParams<typeof events.BulkWithdraw>
export type ChainAddedEventArgs = EParams<typeof events.ChainAdded>
export type ChainAllowMessagesFromEventArgs = EParams<typeof events.ChainAllowMessagesFrom>
export type ChainAllowMessagesToEventArgs = EParams<typeof events.ChainAllowMessagesTo>
export type ChainRemovedEventArgs = EParams<typeof events.ChainRemoved>
export type ChainSetGasLimitEventArgs = EParams<typeof events.ChainSetGasLimit>
export type ChainStopMessagesFromEventArgs = EParams<typeof events.ChainStopMessagesFrom>
export type ChainStopMessagesToEventArgs = EParams<typeof events.ChainStopMessagesTo>
export type ContractWhitelistUpdatedEventArgs = EParams<typeof events.ContractWhitelistUpdated>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type DepositCapUpdatedEventArgs = EParams<typeof events.DepositCapUpdated>
export type DepositRefundedEventArgs = EParams<typeof events.DepositRefunded>
export type KeyringConfigUpdatedEventArgs = EParams<typeof events.KeyringConfigUpdated>
export type ManualWhitelistUpdatedEventArgs = EParams<typeof events.ManualWhitelistUpdated>
export type MessageReceivedEventArgs = EParams<typeof events.MessageReceived>
export type MessageSentEventArgs = EParams<typeof events.MessageSent>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type PeerSetEventArgs = EParams<typeof events.PeerSet>
export type ShareLockPeriodUpdatedEventArgs = EParams<typeof events.ShareLockPeriodUpdated>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type AccessControlModeParams = FunctionArguments<typeof functions.accessControlMode>
export type AccessControlModeReturn = FunctionReturn<typeof functions.accessControlMode>

export type AccountantParams = FunctionArguments<typeof functions.accountant>
export type AccountantReturn = FunctionReturn<typeof functions.accountant>

export type AddAssetParams = FunctionArguments<typeof functions.addAsset>
export type AddAssetReturn = FunctionReturn<typeof functions.addAsset>

export type AddChainParams = FunctionArguments<typeof functions.addChain>
export type AddChainReturn = FunctionReturn<typeof functions.addChain>

export type AllowInitializePathParams = FunctionArguments<typeof functions.allowInitializePath>
export type AllowInitializePathReturn = FunctionReturn<typeof functions.allowInitializePath>

export type AllowMessagesFromChainParams = FunctionArguments<typeof functions.allowMessagesFromChain>
export type AllowMessagesFromChainReturn = FunctionReturn<typeof functions.allowMessagesFromChain>

export type AllowMessagesToChainParams = FunctionArguments<typeof functions.allowMessagesToChain>
export type AllowMessagesToChainReturn = FunctionReturn<typeof functions.allowMessagesToChain>

export type AuthorityParams = FunctionArguments<typeof functions.authority>
export type AuthorityReturn = FunctionReturn<typeof functions.authority>

export type BeforeTransferParams = FunctionArguments<typeof functions.beforeTransfer>
export type BeforeTransferReturn = FunctionReturn<typeof functions.beforeTransfer>

export type BridgeParams = FunctionArguments<typeof functions.bridge>
export type BridgeReturn = FunctionReturn<typeof functions.bridge>

export type BulkDepositParams = FunctionArguments<typeof functions.bulkDeposit>
export type BulkDepositReturn = FunctionReturn<typeof functions.bulkDeposit>

export type BulkWithdrawParams = FunctionArguments<typeof functions.bulkWithdraw>
export type BulkWithdrawReturn = FunctionReturn<typeof functions.bulkWithdraw>

export type ContractWhitelistParams = FunctionArguments<typeof functions.contractWhitelist>
export type ContractWhitelistReturn = FunctionReturn<typeof functions.contractWhitelist>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type DepositAndBridgeParams = FunctionArguments<typeof functions.depositAndBridge>
export type DepositAndBridgeReturn = FunctionReturn<typeof functions.depositAndBridge>

export type DepositCapParams = FunctionArguments<typeof functions.depositCap>
export type DepositCapReturn = FunctionReturn<typeof functions.depositCap>

export type DepositNonceParams = FunctionArguments<typeof functions.depositNonce>
export type DepositNonceReturn = FunctionReturn<typeof functions.depositNonce>

export type DepositWithPermitParams = FunctionArguments<typeof functions.depositWithPermit>
export type DepositWithPermitReturn = FunctionReturn<typeof functions.depositWithPermit>

export type EndpointParams = FunctionArguments<typeof functions.endpoint>
export type EndpointReturn = FunctionReturn<typeof functions.endpoint>

export type IsComposeMsgSenderParams = FunctionArguments<typeof functions.isComposeMsgSender>
export type IsComposeMsgSenderReturn = FunctionReturn<typeof functions.isComposeMsgSender>

export type IsPausedParams = FunctionArguments<typeof functions.isPaused>
export type IsPausedReturn = FunctionReturn<typeof functions.isPaused>

export type IsSupportedParams = FunctionArguments<typeof functions.isSupported>
export type IsSupportedReturn = FunctionReturn<typeof functions.isSupported>

export type KeyringContractParams = FunctionArguments<typeof functions.keyringContract>
export type KeyringContractReturn = FunctionReturn<typeof functions.keyringContract>

export type KeyringPolicyIdParams = FunctionArguments<typeof functions.keyringPolicyId>
export type KeyringPolicyIdReturn = FunctionReturn<typeof functions.keyringPolicyId>

export type LzReceiveParams = FunctionArguments<typeof functions.lzReceive>
export type LzReceiveReturn = FunctionReturn<typeof functions.lzReceive>

export type ManualWhitelistParams = FunctionArguments<typeof functions.manualWhitelist>
export type ManualWhitelistReturn = FunctionReturn<typeof functions.manualWhitelist>

export type NextNonceParams = FunctionArguments<typeof functions.nextNonce>
export type NextNonceReturn = FunctionReturn<typeof functions.nextNonce>

export type OAppVersionParams = FunctionArguments<typeof functions.oAppVersion>
export type OAppVersionReturn = FunctionReturn<typeof functions.oAppVersion>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PeersParams = FunctionArguments<typeof functions.peers>
export type PeersReturn = FunctionReturn<typeof functions.peers>

export type PreviewFeeParams = FunctionArguments<typeof functions.previewFee>
export type PreviewFeeReturn = FunctionReturn<typeof functions.previewFee>

export type PublicDepositHistoryParams = FunctionArguments<typeof functions.publicDepositHistory>
export type PublicDepositHistoryReturn = FunctionReturn<typeof functions.publicDepositHistory>

export type RefundDepositParams = FunctionArguments<typeof functions.refundDeposit>
export type RefundDepositReturn = FunctionReturn<typeof functions.refundDeposit>

export type RemoveAssetParams = FunctionArguments<typeof functions.removeAsset>
export type RemoveAssetReturn = FunctionReturn<typeof functions.removeAsset>

export type RemoveChainParams = FunctionArguments<typeof functions.removeChain>
export type RemoveChainReturn = FunctionReturn<typeof functions.removeChain>

export type SelectorToChainsParams = FunctionArguments<typeof functions.selectorToChains>
export type SelectorToChainsReturn = FunctionReturn<typeof functions.selectorToChains>

export type SetAccessControlModeParams = FunctionArguments<typeof functions.setAccessControlMode>
export type SetAccessControlModeReturn = FunctionReturn<typeof functions.setAccessControlMode>

export type SetAuthorityParams = FunctionArguments<typeof functions.setAuthority>
export type SetAuthorityReturn = FunctionReturn<typeof functions.setAuthority>

export type SetChainGasLimitParams = FunctionArguments<typeof functions.setChainGasLimit>
export type SetChainGasLimitReturn = FunctionReturn<typeof functions.setChainGasLimit>

export type SetDelegateParams = FunctionArguments<typeof functions.setDelegate>
export type SetDelegateReturn = FunctionReturn<typeof functions.setDelegate>

export type SetDepositCapParams = FunctionArguments<typeof functions.setDepositCap>
export type SetDepositCapReturn = FunctionReturn<typeof functions.setDepositCap>

export type SetKeyringConfigParams = FunctionArguments<typeof functions.setKeyringConfig>
export type SetKeyringConfigReturn = FunctionReturn<typeof functions.setKeyringConfig>

export type SetPeerParams = FunctionArguments<typeof functions.setPeer>
export type SetPeerReturn = FunctionReturn<typeof functions.setPeer>

export type SetShareLockPeriodParams = FunctionArguments<typeof functions.setShareLockPeriod>
export type SetShareLockPeriodReturn = FunctionReturn<typeof functions.setShareLockPeriod>

export type ShareLockPeriodParams = FunctionArguments<typeof functions.shareLockPeriod>
export type ShareLockPeriodReturn = FunctionReturn<typeof functions.shareLockPeriod>

export type ShareUnlockTimeParams = FunctionArguments<typeof functions.shareUnlockTime>
export type ShareUnlockTimeReturn = FunctionReturn<typeof functions.shareUnlockTime>

export type StopMessagesFromChainParams = FunctionArguments<typeof functions.stopMessagesFromChain>
export type StopMessagesFromChainReturn = FunctionReturn<typeof functions.stopMessagesFromChain>

export type StopMessagesToChainParams = FunctionArguments<typeof functions.stopMessagesToChain>
export type StopMessagesToChainReturn = FunctionReturn<typeof functions.stopMessagesToChain>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UpdateContractWhitelistParams = FunctionArguments<typeof functions.updateContractWhitelist>
export type UpdateContractWhitelistReturn = FunctionReturn<typeof functions.updateContractWhitelist>

export type UpdateManualWhitelistParams = FunctionArguments<typeof functions.updateManualWhitelist>
export type UpdateManualWhitelistReturn = FunctionReturn<typeof functions.updateManualWhitelist>

export type VaultParams = FunctionArguments<typeof functions.vault>
export type VaultReturn = FunctionReturn<typeof functions.vault>

