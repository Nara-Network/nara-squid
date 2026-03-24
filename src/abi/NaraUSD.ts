import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    Deposit: event("0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "Deposit(address,address,uint256,uint256)", {"sender": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    EIP712DomainChanged: event("0x0a6387c9ea3628b88a633bb4f3b151770f70085117a15f9bf3787cda53f13d31", "EIP712DomainChanged()", {}),
    FeeCollected: event("0x050d44233876ac1dc2b309a53c450bc5e76aa2cdd273ca707147c242f0cad6c6", "FeeCollected(address,uint256,bool)", {"treasury": indexed(p.address), "feeAmount": p.uint256, "isMintFee": p.bool}),
    FeeTreasuryUpdated: event("0xb213ad27ce6db647182439e573968415546e6db3ebfb04b3e84d6b0412025d41", "FeeTreasuryUpdated(address,address)", {"oldTreasury": indexed(p.address), "newTreasury": indexed(p.address)}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    KeyringConfigUpdated: event("0xdd311e842d0dd0d276250faf64c7c9bed12bf94d1e4c1e33b304102684994fc8", "KeyringConfigUpdated(address,uint256)", {"keyringAddress": indexed(p.address), "policyId": p.uint256}),
    KeyringWhitelistUpdated: event("0x8c3adfde14eadcbc1e3834471b73f01eeff0dd863c272b46a8bc3d1b9491479b", "KeyringWhitelistUpdated(address,bool)", {"account": indexed(p.address), "status": p.bool}),
    LockedAmountRedistributed: event("0x12362248730e7cd4fad104772d5f43248c49670dd0c28e44c9402471e7c70bc2", "LockedAmountRedistributed(address,address,uint256,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "walletAmount": p.uint256, "escrowedAmount": p.uint256}),
    MaxMintPerBlockChanged: event("0xb4a832eb73ba0066dc45acd0d1f4454cdee155b17bdb1ccbabb428cc39750ad1", "MaxMintPerBlockChanged(uint256,uint256)", {"oldMax": p.uint256, "newMax": p.uint256}),
    MaxRedeemPerBlockChanged: event("0x6fd3eacad9328fdc902c323518cfef3a2f6a9da89c40a7b82428adc2370114c3", "MaxRedeemPerBlockChanged(uint256,uint256)", {"oldMax": p.uint256, "newMax": p.uint256}),
    MinMintAmountUpdated: event("0xa9d547bad523b2016561d73c8b6f0de927b53e678d07b339173ea7b469ec8969", "MinMintAmountUpdated(uint256,uint256)", {"oldAmount": p.uint256, "newAmount": p.uint256}),
    MinMintFeeAmountUpdated: event("0x749708f5939028d9de02f3535e896e06e7ace158d378eb5306169d46c06ead14", "MinMintFeeAmountUpdated(uint256,uint256)", {"oldAmount": p.uint256, "newAmount": p.uint256}),
    MinRedeemAmountUpdated: event("0x4907c47f25fae2d61aebd707efafc14370bd6a07453c1c215ef0399c6b7866ed", "MinRedeemAmountUpdated(uint256,uint256)", {"oldAmount": p.uint256, "newAmount": p.uint256}),
    MinRedeemFeeAmountUpdated: event("0xe21b33d6a9a21894898f8e5b39990ee75d78531fd0ca982a252d1df52565703f", "MinRedeemFeeAmountUpdated(uint256,uint256)", {"oldAmount": p.uint256, "newAmount": p.uint256}),
    Mint: event("0x2f00e3cdd69a77be7ed215ec7b2a36784dd158f921fca79ac29deffa353fe6ee", "Mint(address,address,uint256,uint256)", {"beneficiary": indexed(p.address), "collateralAsset": indexed(p.address), "collateralAmount": p.uint256, "naraUsdAmount": p.uint256}),
    MintFeeUpdated: event("0x3819eecd18a690739c45cc31dd950f987f756141913ef399a6319f6e232c4491", "MintFeeUpdated(uint16,uint16)", {"oldFeeBps": p.uint16, "newFeeBps": p.uint16}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    Redeem: event("0x3f693fff038bb8a046aa76d9516190ac7444f7d69cf952c4cbdc086fdef2d6fc", "Redeem(address,address,uint256,uint256)", {"beneficiary": indexed(p.address), "collateralAsset": indexed(p.address), "naraUsdAmount": p.uint256, "collateralAmount": p.uint256}),
    RedeemFeeUpdated: event("0x16593e74d00085e90c98de5e8f055f08527ac848f1f8ef1d3b3ec7c4f4e819ff", "RedeemFeeUpdated(uint16,uint16)", {"oldFeeBps": p.uint16, "newFeeBps": p.uint16}),
    RedemptionCancelled: event("0x9aec5cafc1451c1485e4a0099bd4dfb4c9d2bb972b4e5c798da07db8323deaa3", "RedemptionCancelled(address,uint256)", {"user": indexed(p.address), "naraUsdAmount": p.uint256}),
    RedemptionCompleted: event("0xfd418381fd385fa40c54005e4745aac73c2bc925bdbcf3ace12712373c8674a7", "RedemptionCompleted(address,uint256,address,uint256)", {"user": indexed(p.address), "naraUsdAmount": p.uint256, "collateralAsset": indexed(p.address), "collateralAmount": p.uint256}),
    RedemptionRequested: event("0x8d0908d1d11edf5a4765510881f4dff18059c349b11512f1ebcd72a942eabddb", "RedemptionRequested(address,uint256,address)", {"user": indexed(p.address), "naraUsdAmount": p.uint256, "collateralAsset": indexed(p.address)}),
    RoleAdminChanged: event("0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff", "RoleAdminChanged(bytes32,bytes32,bytes32)", {"role": indexed(p.bytes32), "previousAdminRole": indexed(p.bytes32), "newAdminRole": indexed(p.bytes32)}),
    RoleGranted: event("0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d", "RoleGranted(bytes32,address,address)", {"role": indexed(p.bytes32), "account": indexed(p.address), "sender": indexed(p.address)}),
    RoleRevoked: event("0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b", "RoleRevoked(bytes32,address,address)", {"role": indexed(p.bytes32), "account": indexed(p.address), "sender": indexed(p.address)}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
    Upgraded: event("0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b", "Upgraded(address)", {"implementation": indexed(p.address)}),
    Withdraw: event("0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db", "Withdraw(address,address,address,uint256,uint256)", {"sender": indexed(p.address), "receiver": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
}

export const functions = {
    BLACKLIST_MANAGER_ROLE: viewFun("0x410b2424", "BLACKLIST_MANAGER_ROLE()", {}, p.bytes32),
    BPS_DENOMINATOR: viewFun("0xe1a45218", "BPS_DENOMINATOR()", {}, p.uint16),
    COLLATERAL_MANAGER_ROLE: viewFun("0x2e718ab7", "COLLATERAL_MANAGER_ROLE()", {}, p.bytes32),
    DEFAULT_ADMIN_ROLE: viewFun("0xa217fddf", "DEFAULT_ADMIN_ROLE()", {}, p.bytes32),
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    FULL_RESTRICTED_ROLE: viewFun("0x98ba8434", "FULL_RESTRICTED_ROLE()", {}, p.bytes32),
    GATEKEEPER_ROLE: viewFun("0xd6fd3175", "GATEKEEPER_ROLE()", {}, p.bytes32),
    MAX_FEE_BPS: viewFun("0xd55be8c6", "MAX_FEE_BPS()", {}, p.uint16),
    MINTER_ROLE: viewFun("0xd5391393", "MINTER_ROLE()", {}, p.bytes32),
    UPGRADE_INTERFACE_VERSION: viewFun("0xad3cb1cc", "UPGRADE_INTERFACE_VERSION()", {}, p.string),
    addToBlacklist: fun("0x44337ea1", "addToBlacklist(address)", {"target": p.address}, ),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    asset: viewFun("0x38d52e0f", "asset()", {}, p.address),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    bulkCompleteRedeem: fun("0xab7d5a14", "bulkCompleteRedeem(address[])", {"users": p.array(p.address)}, ),
    burn: fun("0x42966c68", "burn(uint256)", {"amount": p.uint256}, ),
    cancelRedeem: fun("0xe6a29666", "cancelRedeem()", {}, ),
    completeRedeem: fun("0x59d76fe7", "completeRedeem(address)", {"user": p.address}, p.uint256),
    convertToAssets: viewFun("0x07a2d13a", "convertToAssets(uint256)", {"shares": p.uint256}, p.uint256),
    convertToShares: viewFun("0xc6e6f592", "convertToShares(uint256)", {"assets": p.uint256}, p.uint256),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    deposit: viewFun("0x6e553f65", "deposit(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    eip712Domain: viewFun("0x84b0196e", "eip712Domain()", {}, {"fields": p.bytes1, "name": p.string, "version": p.string, "chainId": p.uint256, "verifyingContract": p.address, "salt": p.bytes32, "extensions": p.array(p.uint256)}),
    feeTreasury: viewFun("0x60dc2340", "feeTreasury()", {}, p.address),
    getRoleAdmin: viewFun("0x248a9ca3", "getRoleAdmin(bytes32)", {"role": p.bytes32}, p.bytes32),
    grantRole: fun("0x2f2ff15d", "grantRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    hasRole: viewFun("0x91d14854", "hasRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, p.bool),
    hasValidCredentials: viewFun("0x89e6f5ca", "hasValidCredentials(address)", {"account": p.address}, p.bool),
    initialize: fun("0x57fb25cc", "initialize(address,address,uint256,uint256,address)", {"_mct": p.address, "admin": p.address, "_maxMintPerBlock": p.uint256, "_maxRedeemPerBlock": p.uint256, "_redeemSilo": p.address}, ),
    isBlacklisted: viewFun("0xfe575a87", "isBlacklisted(address)", {"account": p.address}, p.bool),
    keyringAddress: viewFun("0x53f77ed1", "keyringAddress()", {}, p.address),
    keyringPolicyId: viewFun("0xd636b05f", "keyringPolicyId()", {}, p.uint256),
    keyringWhitelist: viewFun("0xacea6c1a", "keyringWhitelist(address)", {"_0": p.address}, p.bool),
    maxDeposit: viewFun("0x402d267d", "maxDeposit(address)", {"_0": p.address}, p.uint256),
    maxInstantRedeem: viewFun("0x9c442a1d", "maxInstantRedeem(address,address)", {"owner": p.address, "collateralAsset": p.address}, p.uint256),
    maxMint: viewFun("0xc63d75b6", "maxMint(address)", {"_0": p.address}, p.uint256),
    maxMintPerBlock: viewFun("0x928907dd", "maxMintPerBlock()", {}, p.uint256),
    maxRedeem: viewFun("0xd905777e", "maxRedeem(address)", {"_0": p.address}, p.uint256),
    maxRedeemPerBlock: viewFun("0x844452fa", "maxRedeemPerBlock()", {}, p.uint256),
    maxWithdraw: viewFun("0xce96cb77", "maxWithdraw(address)", {"_0": p.address}, p.uint256),
    mct: viewFun("0xa0580fee", "mct()", {}, p.address),
    minMintAmount: viewFun("0x01e9d757", "minMintAmount()", {}, p.uint256),
    minMintFeeAmount: viewFun("0x0cfde3fa", "minMintFeeAmount()", {}, p.uint256),
    minRedeemAmount: viewFun("0x0912ae6d", "minRedeemAmount()", {}, p.uint256),
    minRedeemFeeAmount: viewFun("0xe18a4ef5", "minRedeemFeeAmount()", {}, p.uint256),
    mint: viewFun("0x94bf804d", "mint(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    mintFeeBps: viewFun("0x97c8bcc1", "mintFeeBps()", {}, p.uint16),
    mintWithCollateral: fun("0x9ebcc252", "mintWithCollateral(address,uint256)", {"collateralAsset": p.address, "collateralAmount": p.uint256}, p.uint256),
    mintWithoutCollateral: fun("0x55313a7b", "mintWithoutCollateral(address,uint256)", {"to": p.address, "amount": p.uint256}, ),
    mintedPerBlock: viewFun("0x2ba32991", "mintedPerBlock(uint256)", {"_0": p.uint256}, p.uint256),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"owner": p.address, "spender": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    previewDeposit: viewFun("0xef8b30f7", "previewDeposit(uint256)", {"assets": p.uint256}, p.uint256),
    previewMint: viewFun("0xb3d7f6b9", "previewMint(uint256)", {"shares": p.uint256}, p.uint256),
    'previewRedeem(uint256)': viewFun("0x4cdad506", "previewRedeem(uint256)", {"_0": p.uint256}, p.uint256),
    'previewRedeem(address,uint256)': viewFun("0xcbe52ae3", "previewRedeem(address,uint256)", {"collateralAsset": p.address, "naraUsdAmount": p.uint256}, p.uint256),
    'previewWithdraw(uint256)': viewFun("0x0a28a477", "previewWithdraw(uint256)", {"_0": p.uint256}, p.uint256),
    'previewWithdraw(address,uint256)': viewFun("0xbbc6f1dc", "previewWithdraw(address,uint256)", {"collateralAsset": p.address, "assets": p.uint256}, p.uint256),
    proxiableUUID: viewFun("0x52d1902d", "proxiableUUID()", {}, p.bytes32),
    'redeem(address,uint256,bool)': fun("0x4458a14c", "redeem(address,uint256,bool)", {"collateralAsset": p.address, "naraUsdAmount": p.uint256, "allowQueue": p.bool}, {"collateralAmount": p.uint256, "wasQueued": p.bool}),
    'redeem(uint256,address,address)': viewFun("0xba087652", "redeem(uint256,address,address)", {"_0": p.uint256, "_1": p.address, "_2": p.address}, p.uint256),
    redeemFeeBps: viewFun("0x09f6442c", "redeemFeeBps()", {}, p.uint16),
    redeemSilo: viewFun("0x84be50e6", "redeemSilo()", {}, p.address),
    redeemedPerBlock: viewFun("0xb6c78063", "redeemedPerBlock(uint256)", {"_0": p.uint256}, p.uint256),
    redemptionRequests: viewFun("0x5e4a9a65", "redemptionRequests(address)", {"user": p.address}, p.struct({"naraUsdAmount": p.uint152, "collateralAsset": p.address})),
    redistributeLockedAmount: fun("0xa0776b82", "redistributeLockedAmount(address,address)", {"from": p.address, "to": p.address}, ),
    removeFromBlacklist: fun("0x537df3b6", "removeFromBlacklist(address)", {"target": p.address}, ),
    renounceRole: fun("0x36568abe", "renounceRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    revokeRole: fun("0xd547741f", "revokeRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    setFeeTreasury: fun("0xbfa37e37", "setFeeTreasury(address)", {"_feeTreasury": p.address}, ),
    setKeyringConfig: fun("0xbd0d9cbd", "setKeyringConfig(address,uint256)", {"_keyringAddress": p.address, "_policyId": p.uint256}, ),
    setKeyringWhitelist: fun("0xe6dee910", "setKeyringWhitelist(address,bool)", {"account": p.address, "status": p.bool}, ),
    setMaxMintPerBlock: fun("0x9cd29136", "setMaxMintPerBlock(uint256)", {"_maxMintPerBlock": p.uint256}, ),
    setMaxRedeemPerBlock: fun("0xd8369d75", "setMaxRedeemPerBlock(uint256)", {"_maxRedeemPerBlock": p.uint256}, ),
    setMinMintAmount: fun("0x1d85d796", "setMinMintAmount(uint256)", {"_minMintAmount": p.uint256}, ),
    setMinMintFeeAmount: fun("0xc7557558", "setMinMintFeeAmount(uint256)", {"_minMintFeeAmount": p.uint256}, ),
    setMinRedeemAmount: fun("0x3e3679d3", "setMinRedeemAmount(uint256)", {"_minRedeemAmount": p.uint256}, ),
    setMinRedeemFeeAmount: fun("0xeccddaff", "setMinRedeemFeeAmount(uint256)", {"_minRedeemFeeAmount": p.uint256}, ),
    setMintFee: fun("0x29b6320d", "setMintFee(uint16)", {"_mintFeeBps": p.uint16}, ),
    setRedeemFee: fun("0x91c022a5", "setRedeemFee(uint16)", {"_redeemFeeBps": p.uint16}, ),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalAssets: viewFun("0x01e1d114", "totalAssets()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    tryCompleteRedeem: fun("0xd4bb049f", "tryCompleteRedeem()", {}, p.uint256),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    updateRedemptionRequest: fun("0x4b3d36fe", "updateRedemptionRequest(uint256)", {"newAmount": p.uint256}, ),
    upgradeToAndCall: fun("0x4f1ef286", "upgradeToAndCall(address,bytes)", {"newImplementation": p.address, "data": p.bytes}, ),
    withdraw: viewFun("0xb460af94", "withdraw(uint256,address,address)", {"_0": p.uint256, "_1": p.address, "_2": p.address}, p.uint256),
}

export class Contract extends ContractBase {

    BLACKLIST_MANAGER_ROLE() {
        return this.eth_call(functions.BLACKLIST_MANAGER_ROLE, {})
    }

    BPS_DENOMINATOR() {
        return this.eth_call(functions.BPS_DENOMINATOR, {})
    }

    COLLATERAL_MANAGER_ROLE() {
        return this.eth_call(functions.COLLATERAL_MANAGER_ROLE, {})
    }

    DEFAULT_ADMIN_ROLE() {
        return this.eth_call(functions.DEFAULT_ADMIN_ROLE, {})
    }

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    FULL_RESTRICTED_ROLE() {
        return this.eth_call(functions.FULL_RESTRICTED_ROLE, {})
    }

    GATEKEEPER_ROLE() {
        return this.eth_call(functions.GATEKEEPER_ROLE, {})
    }

    MAX_FEE_BPS() {
        return this.eth_call(functions.MAX_FEE_BPS, {})
    }

    MINTER_ROLE() {
        return this.eth_call(functions.MINTER_ROLE, {})
    }

    UPGRADE_INTERFACE_VERSION() {
        return this.eth_call(functions.UPGRADE_INTERFACE_VERSION, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    asset() {
        return this.eth_call(functions.asset, {})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    convertToAssets(shares: ConvertToAssetsParams["shares"]) {
        return this.eth_call(functions.convertToAssets, {shares})
    }

    convertToShares(assets: ConvertToSharesParams["assets"]) {
        return this.eth_call(functions.convertToShares, {assets})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    deposit(_0: DepositParams["_0"], _1: DepositParams["_1"]) {
        return this.eth_call(functions.deposit, {_0, _1})
    }

    eip712Domain() {
        return this.eth_call(functions.eip712Domain, {})
    }

    feeTreasury() {
        return this.eth_call(functions.feeTreasury, {})
    }

    getRoleAdmin(role: GetRoleAdminParams["role"]) {
        return this.eth_call(functions.getRoleAdmin, {role})
    }

    hasRole(role: HasRoleParams["role"], account: HasRoleParams["account"]) {
        return this.eth_call(functions.hasRole, {role, account})
    }

    hasValidCredentials(account: HasValidCredentialsParams["account"]) {
        return this.eth_call(functions.hasValidCredentials, {account})
    }

    isBlacklisted(account: IsBlacklistedParams["account"]) {
        return this.eth_call(functions.isBlacklisted, {account})
    }

    keyringAddress() {
        return this.eth_call(functions.keyringAddress, {})
    }

    keyringPolicyId() {
        return this.eth_call(functions.keyringPolicyId, {})
    }

    keyringWhitelist(_0: KeyringWhitelistParams["_0"]) {
        return this.eth_call(functions.keyringWhitelist, {_0})
    }

    maxDeposit(_0: MaxDepositParams["_0"]) {
        return this.eth_call(functions.maxDeposit, {_0})
    }

    maxInstantRedeem(owner: MaxInstantRedeemParams["owner"], collateralAsset: MaxInstantRedeemParams["collateralAsset"]) {
        return this.eth_call(functions.maxInstantRedeem, {owner, collateralAsset})
    }

    maxMint(_0: MaxMintParams["_0"]) {
        return this.eth_call(functions.maxMint, {_0})
    }

    maxMintPerBlock() {
        return this.eth_call(functions.maxMintPerBlock, {})
    }

    maxRedeem(_0: MaxRedeemParams["_0"]) {
        return this.eth_call(functions.maxRedeem, {_0})
    }

    maxRedeemPerBlock() {
        return this.eth_call(functions.maxRedeemPerBlock, {})
    }

    maxWithdraw(_0: MaxWithdrawParams["_0"]) {
        return this.eth_call(functions.maxWithdraw, {_0})
    }

    mct() {
        return this.eth_call(functions.mct, {})
    }

    minMintAmount() {
        return this.eth_call(functions.minMintAmount, {})
    }

    minMintFeeAmount() {
        return this.eth_call(functions.minMintFeeAmount, {})
    }

    minRedeemAmount() {
        return this.eth_call(functions.minRedeemAmount, {})
    }

    minRedeemFeeAmount() {
        return this.eth_call(functions.minRedeemFeeAmount, {})
    }

    mint(_0: MintParams["_0"], _1: MintParams["_1"]) {
        return this.eth_call(functions.mint, {_0, _1})
    }

    mintFeeBps() {
        return this.eth_call(functions.mintFeeBps, {})
    }

    mintedPerBlock(_0: MintedPerBlockParams["_0"]) {
        return this.eth_call(functions.mintedPerBlock, {_0})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    nonces(owner: NoncesParams["owner"]) {
        return this.eth_call(functions.nonces, {owner})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    previewDeposit(assets: PreviewDepositParams["assets"]) {
        return this.eth_call(functions.previewDeposit, {assets})
    }

    previewMint(shares: PreviewMintParams["shares"]) {
        return this.eth_call(functions.previewMint, {shares})
    }

    'previewRedeem(uint256)'(_0: PreviewRedeemParams_0["_0"]) {
        return this.eth_call(functions['previewRedeem(uint256)'], {_0})
    }

    'previewRedeem(address,uint256)'(collateralAsset: PreviewRedeemParams_1["collateralAsset"], naraUsdAmount: PreviewRedeemParams_1["naraUsdAmount"]) {
        return this.eth_call(functions['previewRedeem(address,uint256)'], {collateralAsset, naraUsdAmount})
    }

    'previewWithdraw(uint256)'(_0: PreviewWithdrawParams_0["_0"]) {
        return this.eth_call(functions['previewWithdraw(uint256)'], {_0})
    }

    'previewWithdraw(address,uint256)'(collateralAsset: PreviewWithdrawParams_1["collateralAsset"], assets: PreviewWithdrawParams_1["assets"]) {
        return this.eth_call(functions['previewWithdraw(address,uint256)'], {collateralAsset, assets})
    }

    proxiableUUID() {
        return this.eth_call(functions.proxiableUUID, {})
    }

    'redeem(uint256,address,address)'(_0: RedeemParams_1["_0"], _1: RedeemParams_1["_1"], _2: RedeemParams_1["_2"]) {
        return this.eth_call(functions['redeem(uint256,address,address)'], {_0, _1, _2})
    }

    redeemFeeBps() {
        return this.eth_call(functions.redeemFeeBps, {})
    }

    redeemSilo() {
        return this.eth_call(functions.redeemSilo, {})
    }

    redeemedPerBlock(_0: RedeemedPerBlockParams["_0"]) {
        return this.eth_call(functions.redeemedPerBlock, {_0})
    }

    redemptionRequests(user: RedemptionRequestsParams["user"]) {
        return this.eth_call(functions.redemptionRequests, {user})
    }

    supportsInterface(interfaceId: SupportsInterfaceParams["interfaceId"]) {
        return this.eth_call(functions.supportsInterface, {interfaceId})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    totalAssets() {
        return this.eth_call(functions.totalAssets, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    withdraw(_0: WithdrawParams["_0"], _1: WithdrawParams["_1"], _2: WithdrawParams["_2"]) {
        return this.eth_call(functions.withdraw, {_0, _1, _2})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type EIP712DomainChangedEventArgs = EParams<typeof events.EIP712DomainChanged>
export type FeeCollectedEventArgs = EParams<typeof events.FeeCollected>
export type FeeTreasuryUpdatedEventArgs = EParams<typeof events.FeeTreasuryUpdated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type KeyringConfigUpdatedEventArgs = EParams<typeof events.KeyringConfigUpdated>
export type KeyringWhitelistUpdatedEventArgs = EParams<typeof events.KeyringWhitelistUpdated>
export type LockedAmountRedistributedEventArgs = EParams<typeof events.LockedAmountRedistributed>
export type MaxMintPerBlockChangedEventArgs = EParams<typeof events.MaxMintPerBlockChanged>
export type MaxRedeemPerBlockChangedEventArgs = EParams<typeof events.MaxRedeemPerBlockChanged>
export type MinMintAmountUpdatedEventArgs = EParams<typeof events.MinMintAmountUpdated>
export type MinMintFeeAmountUpdatedEventArgs = EParams<typeof events.MinMintFeeAmountUpdated>
export type MinRedeemAmountUpdatedEventArgs = EParams<typeof events.MinRedeemAmountUpdated>
export type MinRedeemFeeAmountUpdatedEventArgs = EParams<typeof events.MinRedeemFeeAmountUpdated>
export type MintEventArgs = EParams<typeof events.Mint>
export type MintFeeUpdatedEventArgs = EParams<typeof events.MintFeeUpdated>
export type PausedEventArgs = EParams<typeof events.Paused>
export type RedeemEventArgs = EParams<typeof events.Redeem>
export type RedeemFeeUpdatedEventArgs = EParams<typeof events.RedeemFeeUpdated>
export type RedemptionCancelledEventArgs = EParams<typeof events.RedemptionCancelled>
export type RedemptionCompletedEventArgs = EParams<typeof events.RedemptionCompleted>
export type RedemptionRequestedEventArgs = EParams<typeof events.RedemptionRequested>
export type RoleAdminChangedEventArgs = EParams<typeof events.RoleAdminChanged>
export type RoleGrantedEventArgs = EParams<typeof events.RoleGranted>
export type RoleRevokedEventArgs = EParams<typeof events.RoleRevoked>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type UpgradedEventArgs = EParams<typeof events.Upgraded>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type BLACKLIST_MANAGER_ROLEParams = FunctionArguments<typeof functions.BLACKLIST_MANAGER_ROLE>
export type BLACKLIST_MANAGER_ROLEReturn = FunctionReturn<typeof functions.BLACKLIST_MANAGER_ROLE>

export type BPS_DENOMINATORParams = FunctionArguments<typeof functions.BPS_DENOMINATOR>
export type BPS_DENOMINATORReturn = FunctionReturn<typeof functions.BPS_DENOMINATOR>

export type COLLATERAL_MANAGER_ROLEParams = FunctionArguments<typeof functions.COLLATERAL_MANAGER_ROLE>
export type COLLATERAL_MANAGER_ROLEReturn = FunctionReturn<typeof functions.COLLATERAL_MANAGER_ROLE>

export type DEFAULT_ADMIN_ROLEParams = FunctionArguments<typeof functions.DEFAULT_ADMIN_ROLE>
export type DEFAULT_ADMIN_ROLEReturn = FunctionReturn<typeof functions.DEFAULT_ADMIN_ROLE>

export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type FULL_RESTRICTED_ROLEParams = FunctionArguments<typeof functions.FULL_RESTRICTED_ROLE>
export type FULL_RESTRICTED_ROLEReturn = FunctionReturn<typeof functions.FULL_RESTRICTED_ROLE>

export type GATEKEEPER_ROLEParams = FunctionArguments<typeof functions.GATEKEEPER_ROLE>
export type GATEKEEPER_ROLEReturn = FunctionReturn<typeof functions.GATEKEEPER_ROLE>

export type MAX_FEE_BPSParams = FunctionArguments<typeof functions.MAX_FEE_BPS>
export type MAX_FEE_BPSReturn = FunctionReturn<typeof functions.MAX_FEE_BPS>

export type MINTER_ROLEParams = FunctionArguments<typeof functions.MINTER_ROLE>
export type MINTER_ROLEReturn = FunctionReturn<typeof functions.MINTER_ROLE>

export type UPGRADE_INTERFACE_VERSIONParams = FunctionArguments<typeof functions.UPGRADE_INTERFACE_VERSION>
export type UPGRADE_INTERFACE_VERSIONReturn = FunctionReturn<typeof functions.UPGRADE_INTERFACE_VERSION>

export type AddToBlacklistParams = FunctionArguments<typeof functions.addToBlacklist>
export type AddToBlacklistReturn = FunctionReturn<typeof functions.addToBlacklist>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type AssetParams = FunctionArguments<typeof functions.asset>
export type AssetReturn = FunctionReturn<typeof functions.asset>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BulkCompleteRedeemParams = FunctionArguments<typeof functions.bulkCompleteRedeem>
export type BulkCompleteRedeemReturn = FunctionReturn<typeof functions.bulkCompleteRedeem>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type CancelRedeemParams = FunctionArguments<typeof functions.cancelRedeem>
export type CancelRedeemReturn = FunctionReturn<typeof functions.cancelRedeem>

export type CompleteRedeemParams = FunctionArguments<typeof functions.completeRedeem>
export type CompleteRedeemReturn = FunctionReturn<typeof functions.completeRedeem>

export type ConvertToAssetsParams = FunctionArguments<typeof functions.convertToAssets>
export type ConvertToAssetsReturn = FunctionReturn<typeof functions.convertToAssets>

export type ConvertToSharesParams = FunctionArguments<typeof functions.convertToShares>
export type ConvertToSharesReturn = FunctionReturn<typeof functions.convertToShares>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type Eip712DomainParams = FunctionArguments<typeof functions.eip712Domain>
export type Eip712DomainReturn = FunctionReturn<typeof functions.eip712Domain>

export type FeeTreasuryParams = FunctionArguments<typeof functions.feeTreasury>
export type FeeTreasuryReturn = FunctionReturn<typeof functions.feeTreasury>

export type GetRoleAdminParams = FunctionArguments<typeof functions.getRoleAdmin>
export type GetRoleAdminReturn = FunctionReturn<typeof functions.getRoleAdmin>

export type GrantRoleParams = FunctionArguments<typeof functions.grantRole>
export type GrantRoleReturn = FunctionReturn<typeof functions.grantRole>

export type HasRoleParams = FunctionArguments<typeof functions.hasRole>
export type HasRoleReturn = FunctionReturn<typeof functions.hasRole>

export type HasValidCredentialsParams = FunctionArguments<typeof functions.hasValidCredentials>
export type HasValidCredentialsReturn = FunctionReturn<typeof functions.hasValidCredentials>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsBlacklistedParams = FunctionArguments<typeof functions.isBlacklisted>
export type IsBlacklistedReturn = FunctionReturn<typeof functions.isBlacklisted>

export type KeyringAddressParams = FunctionArguments<typeof functions.keyringAddress>
export type KeyringAddressReturn = FunctionReturn<typeof functions.keyringAddress>

export type KeyringPolicyIdParams = FunctionArguments<typeof functions.keyringPolicyId>
export type KeyringPolicyIdReturn = FunctionReturn<typeof functions.keyringPolicyId>

export type KeyringWhitelistParams = FunctionArguments<typeof functions.keyringWhitelist>
export type KeyringWhitelistReturn = FunctionReturn<typeof functions.keyringWhitelist>

export type MaxDepositParams = FunctionArguments<typeof functions.maxDeposit>
export type MaxDepositReturn = FunctionReturn<typeof functions.maxDeposit>

export type MaxInstantRedeemParams = FunctionArguments<typeof functions.maxInstantRedeem>
export type MaxInstantRedeemReturn = FunctionReturn<typeof functions.maxInstantRedeem>

export type MaxMintParams = FunctionArguments<typeof functions.maxMint>
export type MaxMintReturn = FunctionReturn<typeof functions.maxMint>

export type MaxMintPerBlockParams = FunctionArguments<typeof functions.maxMintPerBlock>
export type MaxMintPerBlockReturn = FunctionReturn<typeof functions.maxMintPerBlock>

export type MaxRedeemParams = FunctionArguments<typeof functions.maxRedeem>
export type MaxRedeemReturn = FunctionReturn<typeof functions.maxRedeem>

export type MaxRedeemPerBlockParams = FunctionArguments<typeof functions.maxRedeemPerBlock>
export type MaxRedeemPerBlockReturn = FunctionReturn<typeof functions.maxRedeemPerBlock>

export type MaxWithdrawParams = FunctionArguments<typeof functions.maxWithdraw>
export type MaxWithdrawReturn = FunctionReturn<typeof functions.maxWithdraw>

export type MctParams = FunctionArguments<typeof functions.mct>
export type MctReturn = FunctionReturn<typeof functions.mct>

export type MinMintAmountParams = FunctionArguments<typeof functions.minMintAmount>
export type MinMintAmountReturn = FunctionReturn<typeof functions.minMintAmount>

export type MinMintFeeAmountParams = FunctionArguments<typeof functions.minMintFeeAmount>
export type MinMintFeeAmountReturn = FunctionReturn<typeof functions.minMintFeeAmount>

export type MinRedeemAmountParams = FunctionArguments<typeof functions.minRedeemAmount>
export type MinRedeemAmountReturn = FunctionReturn<typeof functions.minRedeemAmount>

export type MinRedeemFeeAmountParams = FunctionArguments<typeof functions.minRedeemFeeAmount>
export type MinRedeemFeeAmountReturn = FunctionReturn<typeof functions.minRedeemFeeAmount>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type MintFeeBpsParams = FunctionArguments<typeof functions.mintFeeBps>
export type MintFeeBpsReturn = FunctionReturn<typeof functions.mintFeeBps>

export type MintWithCollateralParams = FunctionArguments<typeof functions.mintWithCollateral>
export type MintWithCollateralReturn = FunctionReturn<typeof functions.mintWithCollateral>

export type MintWithoutCollateralParams = FunctionArguments<typeof functions.mintWithoutCollateral>
export type MintWithoutCollateralReturn = FunctionReturn<typeof functions.mintWithoutCollateral>

export type MintedPerBlockParams = FunctionArguments<typeof functions.mintedPerBlock>
export type MintedPerBlockReturn = FunctionReturn<typeof functions.mintedPerBlock>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type NoncesParams = FunctionArguments<typeof functions.nonces>
export type NoncesReturn = FunctionReturn<typeof functions.nonces>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type PermitParams = FunctionArguments<typeof functions.permit>
export type PermitReturn = FunctionReturn<typeof functions.permit>

export type PreviewDepositParams = FunctionArguments<typeof functions.previewDeposit>
export type PreviewDepositReturn = FunctionReturn<typeof functions.previewDeposit>

export type PreviewMintParams = FunctionArguments<typeof functions.previewMint>
export type PreviewMintReturn = FunctionReturn<typeof functions.previewMint>

export type PreviewRedeemParams_0 = FunctionArguments<typeof functions['previewRedeem(uint256)']>
export type PreviewRedeemReturn_0 = FunctionReturn<typeof functions['previewRedeem(uint256)']>

export type PreviewRedeemParams_1 = FunctionArguments<typeof functions['previewRedeem(address,uint256)']>
export type PreviewRedeemReturn_1 = FunctionReturn<typeof functions['previewRedeem(address,uint256)']>

export type PreviewWithdrawParams_0 = FunctionArguments<typeof functions['previewWithdraw(uint256)']>
export type PreviewWithdrawReturn_0 = FunctionReturn<typeof functions['previewWithdraw(uint256)']>

export type PreviewWithdrawParams_1 = FunctionArguments<typeof functions['previewWithdraw(address,uint256)']>
export type PreviewWithdrawReturn_1 = FunctionReturn<typeof functions['previewWithdraw(address,uint256)']>

export type ProxiableUUIDParams = FunctionArguments<typeof functions.proxiableUUID>
export type ProxiableUUIDReturn = FunctionReturn<typeof functions.proxiableUUID>

export type RedeemParams_0 = FunctionArguments<typeof functions['redeem(address,uint256,bool)']>
export type RedeemReturn_0 = FunctionReturn<typeof functions['redeem(address,uint256,bool)']>

export type RedeemParams_1 = FunctionArguments<typeof functions['redeem(uint256,address,address)']>
export type RedeemReturn_1 = FunctionReturn<typeof functions['redeem(uint256,address,address)']>

export type RedeemFeeBpsParams = FunctionArguments<typeof functions.redeemFeeBps>
export type RedeemFeeBpsReturn = FunctionReturn<typeof functions.redeemFeeBps>

export type RedeemSiloParams = FunctionArguments<typeof functions.redeemSilo>
export type RedeemSiloReturn = FunctionReturn<typeof functions.redeemSilo>

export type RedeemedPerBlockParams = FunctionArguments<typeof functions.redeemedPerBlock>
export type RedeemedPerBlockReturn = FunctionReturn<typeof functions.redeemedPerBlock>

export type RedemptionRequestsParams = FunctionArguments<typeof functions.redemptionRequests>
export type RedemptionRequestsReturn = FunctionReturn<typeof functions.redemptionRequests>

export type RedistributeLockedAmountParams = FunctionArguments<typeof functions.redistributeLockedAmount>
export type RedistributeLockedAmountReturn = FunctionReturn<typeof functions.redistributeLockedAmount>

export type RemoveFromBlacklistParams = FunctionArguments<typeof functions.removeFromBlacklist>
export type RemoveFromBlacklistReturn = FunctionReturn<typeof functions.removeFromBlacklist>

export type RenounceRoleParams = FunctionArguments<typeof functions.renounceRole>
export type RenounceRoleReturn = FunctionReturn<typeof functions.renounceRole>

export type RevokeRoleParams = FunctionArguments<typeof functions.revokeRole>
export type RevokeRoleReturn = FunctionReturn<typeof functions.revokeRole>

export type SetFeeTreasuryParams = FunctionArguments<typeof functions.setFeeTreasury>
export type SetFeeTreasuryReturn = FunctionReturn<typeof functions.setFeeTreasury>

export type SetKeyringConfigParams = FunctionArguments<typeof functions.setKeyringConfig>
export type SetKeyringConfigReturn = FunctionReturn<typeof functions.setKeyringConfig>

export type SetKeyringWhitelistParams = FunctionArguments<typeof functions.setKeyringWhitelist>
export type SetKeyringWhitelistReturn = FunctionReturn<typeof functions.setKeyringWhitelist>

export type SetMaxMintPerBlockParams = FunctionArguments<typeof functions.setMaxMintPerBlock>
export type SetMaxMintPerBlockReturn = FunctionReturn<typeof functions.setMaxMintPerBlock>

export type SetMaxRedeemPerBlockParams = FunctionArguments<typeof functions.setMaxRedeemPerBlock>
export type SetMaxRedeemPerBlockReturn = FunctionReturn<typeof functions.setMaxRedeemPerBlock>

export type SetMinMintAmountParams = FunctionArguments<typeof functions.setMinMintAmount>
export type SetMinMintAmountReturn = FunctionReturn<typeof functions.setMinMintAmount>

export type SetMinMintFeeAmountParams = FunctionArguments<typeof functions.setMinMintFeeAmount>
export type SetMinMintFeeAmountReturn = FunctionReturn<typeof functions.setMinMintFeeAmount>

export type SetMinRedeemAmountParams = FunctionArguments<typeof functions.setMinRedeemAmount>
export type SetMinRedeemAmountReturn = FunctionReturn<typeof functions.setMinRedeemAmount>

export type SetMinRedeemFeeAmountParams = FunctionArguments<typeof functions.setMinRedeemFeeAmount>
export type SetMinRedeemFeeAmountReturn = FunctionReturn<typeof functions.setMinRedeemFeeAmount>

export type SetMintFeeParams = FunctionArguments<typeof functions.setMintFee>
export type SetMintFeeReturn = FunctionReturn<typeof functions.setMintFee>

export type SetRedeemFeeParams = FunctionArguments<typeof functions.setRedeemFee>
export type SetRedeemFeeReturn = FunctionReturn<typeof functions.setRedeemFee>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TotalAssetsParams = FunctionArguments<typeof functions.totalAssets>
export type TotalAssetsReturn = FunctionReturn<typeof functions.totalAssets>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TryCompleteRedeemParams = FunctionArguments<typeof functions.tryCompleteRedeem>
export type TryCompleteRedeemReturn = FunctionReturn<typeof functions.tryCompleteRedeem>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UpdateRedemptionRequestParams = FunctionArguments<typeof functions.updateRedemptionRequest>
export type UpdateRedemptionRequestReturn = FunctionReturn<typeof functions.updateRedemptionRequest>

export type UpgradeToAndCallParams = FunctionArguments<typeof functions.upgradeToAndCall>
export type UpgradeToAndCallReturn = FunctionReturn<typeof functions.upgradeToAndCall>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

