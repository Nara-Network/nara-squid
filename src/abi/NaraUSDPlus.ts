import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    AssetsBurned: event("0x9619cdcf8c4aad4d95caca78ae25ac581608d66186eba65033a49acbe95fd6d1", "AssetsBurned(uint256)", {"amount": p.uint256}),
    CooldownDurationUpdated: event("0x180eacdf7dbaeecaa983d93173b4285db2f2c0de0044697e1f932bbbb73dcaa6", "CooldownDurationUpdated(uint24,uint24)", {"previousDuration": p.uint24, "newDuration": p.uint24}),
    Deposit: event("0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7", "Deposit(address,address,uint256,uint256)", {"sender": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
    EIP712DomainChanged: event("0x0a6387c9ea3628b88a633bb4f3b151770f70085117a15f9bf3787cda53f13d31", "EIP712DomainChanged()", {}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    LockedAmountRedistributed: event("0xb8ef21f2b52f8ca740012254a6b10f17d2fd6e589f97ebf401fde0e8b9218937", "LockedAmountRedistributed(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    RewardsReceived: event("0xbb28dd7cd6be6f61828ea9158a04c5182c716a946a6d2f31f4864edb87471aa6", "RewardsReceived(uint256)", {"amount": p.uint256}),
    RoleAdminChanged: event("0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff", "RoleAdminChanged(bytes32,bytes32,bytes32)", {"role": indexed(p.bytes32), "previousAdminRole": indexed(p.bytes32), "newAdminRole": indexed(p.bytes32)}),
    RoleGranted: event("0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d", "RoleGranted(bytes32,address,address)", {"role": indexed(p.bytes32), "account": indexed(p.address), "sender": indexed(p.address)}),
    RoleRevoked: event("0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b", "RoleRevoked(bytes32,address,address)", {"role": indexed(p.bytes32), "account": indexed(p.address), "sender": indexed(p.address)}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
    Upgraded: event("0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b", "Upgraded(address)", {"implementation": indexed(p.address)}),
    VestingPeriodUpdated: event("0x2543ef20d7e1e2939d7ba6a2d4f2bc50e3098ccfd274aafcb3f263dc3585f2d7", "VestingPeriodUpdated(uint256,uint256)", {"previousPeriod": p.uint256, "newPeriod": p.uint256}),
    Withdraw: event("0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db", "Withdraw(address,address,address,uint256,uint256)", {"sender": indexed(p.address), "receiver": indexed(p.address), "owner": indexed(p.address), "assets": p.uint256, "shares": p.uint256}),
}

export const functions = {
    BLACKLIST_MANAGER_ROLE: viewFun("0x410b2424", "BLACKLIST_MANAGER_ROLE()", {}, p.bytes32),
    DEFAULT_ADMIN_ROLE: viewFun("0xa217fddf", "DEFAULT_ADMIN_ROLE()", {}, p.bytes32),
    DOMAIN_SEPARATOR: viewFun("0x3644e515", "DOMAIN_SEPARATOR()", {}, p.bytes32),
    FULL_RESTRICTED_STAKER_ROLE: viewFun("0x2638f09f", "FULL_RESTRICTED_STAKER_ROLE()", {}, p.bytes32),
    GATEKEEPER_ROLE: viewFun("0xd6fd3175", "GATEKEEPER_ROLE()", {}, p.bytes32),
    MAX_COOLDOWN_DURATION: viewFun("0x1e9049cf", "MAX_COOLDOWN_DURATION()", {}, p.uint24),
    MAX_VESTING_PERIOD: viewFun("0xe5a5e674", "MAX_VESTING_PERIOD()", {}, p.uint256),
    MIN_SHARES: viewFun("0x1fcd3080", "MIN_SHARES()", {}, p.uint256),
    REWARDER_ROLE: viewFun("0x8580cf76", "REWARDER_ROLE()", {}, p.bytes32),
    UPGRADE_INTERFACE_VERSION: viewFun("0xad3cb1cc", "UPGRADE_INTERFACE_VERSION()", {}, p.string),
    addToBlacklist: fun("0x44337ea1", "addToBlacklist(address)", {"target": p.address}, ),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    asset: viewFun("0x38d52e0f", "asset()", {}, p.address),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    burnAssets: fun("0x085ce8d5", "burnAssets(uint256)", {"amount": p.uint256}, ),
    cancelCooldown: fun("0x7674e44e", "cancelCooldown()", {}, ),
    convertToAssets: viewFun("0x07a2d13a", "convertToAssets(uint256)", {"shares": p.uint256}, p.uint256),
    convertToShares: viewFun("0xc6e6f592", "convertToShares(uint256)", {"assets": p.uint256}, p.uint256),
    cooldownAssets: fun("0xcdac52ed", "cooldownAssets(uint256)", {"assets": p.uint256}, p.uint256),
    cooldownDuration: viewFun("0x35269315", "cooldownDuration()", {}, p.uint24),
    cooldownShares: fun("0x9343d9e1", "cooldownShares(uint256)", {"shares": p.uint256}, p.uint256),
    cooldowns: viewFun("0x01320fe2", "cooldowns(address)", {"_0": p.address}, {"cooldownEnd": p.uint104, "sharesAmount": p.uint152}),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    deposit: fun("0x6e553f65", "deposit(uint256,address)", {"assets": p.uint256, "receiver": p.address}, p.uint256),
    eip712Domain: viewFun("0x84b0196e", "eip712Domain()", {}, {"fields": p.bytes1, "name": p.string, "version": p.string, "chainId": p.uint256, "verifyingContract": p.address, "salt": p.bytes32, "extensions": p.array(p.uint256)}),
    getRoleAdmin: viewFun("0x248a9ca3", "getRoleAdmin(bytes32)", {"role": p.bytes32}, p.bytes32),
    getUnvestedAmount: viewFun("0xe7c2a608", "getUnvestedAmount()", {}, p.uint256),
    grantRole: fun("0x2f2ff15d", "grantRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    hasRole: viewFun("0x91d14854", "hasRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, p.bool),
    initialize: fun("0xf8c8765e", "initialize(address,address,address,address)", {"_asset": p.address, "_initialRewarder": p.address, "_admin": p.address, "_silo": p.address}, ),
    isBlacklisted: viewFun("0xfe575a87", "isBlacklisted(address)", {"account": p.address}, p.bool),
    lastDistributionTimestamp: viewFun("0x20950933", "lastDistributionTimestamp()", {}, p.uint256),
    maxDeposit: viewFun("0x402d267d", "maxDeposit(address)", {"_0": p.address}, p.uint256),
    maxMint: viewFun("0xc63d75b6", "maxMint(address)", {"_0": p.address}, p.uint256),
    maxRedeem: viewFun("0xd905777e", "maxRedeem(address)", {"owner": p.address}, p.uint256),
    maxWithdraw: viewFun("0xce96cb77", "maxWithdraw(address)", {"owner": p.address}, p.uint256),
    minShares: viewFun("0x3c3b1795", "minShares()", {}, p.uint256),
    mint: fun("0x94bf804d", "mint(uint256,address)", {"shares": p.uint256, "receiver": p.address}, p.uint256),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    nonces: viewFun("0x7ecebe00", "nonces(address)", {"owner": p.address}, p.uint256),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    permit: fun("0xd505accf", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", {"owner": p.address, "spender": p.address, "value": p.uint256, "deadline": p.uint256, "v": p.uint8, "r": p.bytes32, "s": p.bytes32}, ),
    previewDeposit: viewFun("0xef8b30f7", "previewDeposit(uint256)", {"assets": p.uint256}, p.uint256),
    previewMint: viewFun("0xb3d7f6b9", "previewMint(uint256)", {"shares": p.uint256}, p.uint256),
    previewRedeem: viewFun("0x4cdad506", "previewRedeem(uint256)", {"shares": p.uint256}, p.uint256),
    previewWithdraw: viewFun("0x0a28a477", "previewWithdraw(uint256)", {"assets": p.uint256}, p.uint256),
    proxiableUUID: viewFun("0x52d1902d", "proxiableUUID()", {}, p.bytes32),
    redeem: fun("0xba087652", "redeem(uint256,address,address)", {"shares": p.uint256, "receiver": p.address, "owner": p.address}, p.uint256),
    redistributeLockedAmount: fun("0xa0776b82", "redistributeLockedAmount(address,address)", {"from": p.address, "to": p.address}, ),
    removeFromBlacklist: fun("0x537df3b6", "removeFromBlacklist(address)", {"target": p.address}, ),
    renounceRole: fun("0x36568abe", "renounceRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    rescueTokens: fun("0xb37fd190", "rescueTokens(address,uint256,address)", {"token": p.address, "amount": p.uint256, "to": p.address}, ),
    revokeRole: fun("0xd547741f", "revokeRole(bytes32,address)", {"role": p.bytes32, "account": p.address}, ),
    setCooldownDuration: fun("0xce23eb3c", "setCooldownDuration(uint24)", {"duration": p.uint24}, ),
    setVestingPeriod: fun("0x40bee0ed", "setVestingPeriod(uint256)", {"period": p.uint256}, ),
    silo: viewFun("0xeb3beb29", "silo()", {}, p.address),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalAssets: viewFun("0x01e1d114", "totalAssets()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    transferInRewards: fun("0xc80ef110", "transferInRewards(uint256)", {"amount": p.uint256}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    unstake: fun("0xf2888dbb", "unstake(address)", {"receiver": p.address}, ),
    upgradeToAndCall: fun("0x4f1ef286", "upgradeToAndCall(address,bytes)", {"newImplementation": p.address, "data": p.bytes}, ),
    vestingAmount: viewFun("0x00728f76", "vestingAmount()", {}, p.uint256),
    vestingPeriod: viewFun("0x7313ee5a", "vestingPeriod()", {}, p.uint256),
    withdraw: fun("0xb460af94", "withdraw(uint256,address,address)", {"assets": p.uint256, "receiver": p.address, "owner": p.address}, p.uint256),
}

export class Contract extends ContractBase {

    BLACKLIST_MANAGER_ROLE() {
        return this.eth_call(functions.BLACKLIST_MANAGER_ROLE, {})
    }

    DEFAULT_ADMIN_ROLE() {
        return this.eth_call(functions.DEFAULT_ADMIN_ROLE, {})
    }

    DOMAIN_SEPARATOR() {
        return this.eth_call(functions.DOMAIN_SEPARATOR, {})
    }

    FULL_RESTRICTED_STAKER_ROLE() {
        return this.eth_call(functions.FULL_RESTRICTED_STAKER_ROLE, {})
    }

    GATEKEEPER_ROLE() {
        return this.eth_call(functions.GATEKEEPER_ROLE, {})
    }

    MAX_COOLDOWN_DURATION() {
        return this.eth_call(functions.MAX_COOLDOWN_DURATION, {})
    }

    MAX_VESTING_PERIOD() {
        return this.eth_call(functions.MAX_VESTING_PERIOD, {})
    }

    MIN_SHARES() {
        return this.eth_call(functions.MIN_SHARES, {})
    }

    REWARDER_ROLE() {
        return this.eth_call(functions.REWARDER_ROLE, {})
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

    cooldownDuration() {
        return this.eth_call(functions.cooldownDuration, {})
    }

    cooldowns(_0: CooldownsParams["_0"]) {
        return this.eth_call(functions.cooldowns, {_0})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    eip712Domain() {
        return this.eth_call(functions.eip712Domain, {})
    }

    getRoleAdmin(role: GetRoleAdminParams["role"]) {
        return this.eth_call(functions.getRoleAdmin, {role})
    }

    getUnvestedAmount() {
        return this.eth_call(functions.getUnvestedAmount, {})
    }

    hasRole(role: HasRoleParams["role"], account: HasRoleParams["account"]) {
        return this.eth_call(functions.hasRole, {role, account})
    }

    isBlacklisted(account: IsBlacklistedParams["account"]) {
        return this.eth_call(functions.isBlacklisted, {account})
    }

    lastDistributionTimestamp() {
        return this.eth_call(functions.lastDistributionTimestamp, {})
    }

    maxDeposit(_0: MaxDepositParams["_0"]) {
        return this.eth_call(functions.maxDeposit, {_0})
    }

    maxMint(_0: MaxMintParams["_0"]) {
        return this.eth_call(functions.maxMint, {_0})
    }

    maxRedeem(owner: MaxRedeemParams["owner"]) {
        return this.eth_call(functions.maxRedeem, {owner})
    }

    maxWithdraw(owner: MaxWithdrawParams["owner"]) {
        return this.eth_call(functions.maxWithdraw, {owner})
    }

    minShares() {
        return this.eth_call(functions.minShares, {})
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

    previewRedeem(shares: PreviewRedeemParams["shares"]) {
        return this.eth_call(functions.previewRedeem, {shares})
    }

    previewWithdraw(assets: PreviewWithdrawParams["assets"]) {
        return this.eth_call(functions.previewWithdraw, {assets})
    }

    proxiableUUID() {
        return this.eth_call(functions.proxiableUUID, {})
    }

    silo() {
        return this.eth_call(functions.silo, {})
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

    vestingAmount() {
        return this.eth_call(functions.vestingAmount, {})
    }

    vestingPeriod() {
        return this.eth_call(functions.vestingPeriod, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type AssetsBurnedEventArgs = EParams<typeof events.AssetsBurned>
export type CooldownDurationUpdatedEventArgs = EParams<typeof events.CooldownDurationUpdated>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type EIP712DomainChangedEventArgs = EParams<typeof events.EIP712DomainChanged>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type LockedAmountRedistributedEventArgs = EParams<typeof events.LockedAmountRedistributed>
export type PausedEventArgs = EParams<typeof events.Paused>
export type RewardsReceivedEventArgs = EParams<typeof events.RewardsReceived>
export type RoleAdminChangedEventArgs = EParams<typeof events.RoleAdminChanged>
export type RoleGrantedEventArgs = EParams<typeof events.RoleGranted>
export type RoleRevokedEventArgs = EParams<typeof events.RoleRevoked>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type UpgradedEventArgs = EParams<typeof events.Upgraded>
export type VestingPeriodUpdatedEventArgs = EParams<typeof events.VestingPeriodUpdated>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type BLACKLIST_MANAGER_ROLEParams = FunctionArguments<typeof functions.BLACKLIST_MANAGER_ROLE>
export type BLACKLIST_MANAGER_ROLEReturn = FunctionReturn<typeof functions.BLACKLIST_MANAGER_ROLE>

export type DEFAULT_ADMIN_ROLEParams = FunctionArguments<typeof functions.DEFAULT_ADMIN_ROLE>
export type DEFAULT_ADMIN_ROLEReturn = FunctionReturn<typeof functions.DEFAULT_ADMIN_ROLE>

export type DOMAIN_SEPARATORParams = FunctionArguments<typeof functions.DOMAIN_SEPARATOR>
export type DOMAIN_SEPARATORReturn = FunctionReturn<typeof functions.DOMAIN_SEPARATOR>

export type FULL_RESTRICTED_STAKER_ROLEParams = FunctionArguments<typeof functions.FULL_RESTRICTED_STAKER_ROLE>
export type FULL_RESTRICTED_STAKER_ROLEReturn = FunctionReturn<typeof functions.FULL_RESTRICTED_STAKER_ROLE>

export type GATEKEEPER_ROLEParams = FunctionArguments<typeof functions.GATEKEEPER_ROLE>
export type GATEKEEPER_ROLEReturn = FunctionReturn<typeof functions.GATEKEEPER_ROLE>

export type MAX_COOLDOWN_DURATIONParams = FunctionArguments<typeof functions.MAX_COOLDOWN_DURATION>
export type MAX_COOLDOWN_DURATIONReturn = FunctionReturn<typeof functions.MAX_COOLDOWN_DURATION>

export type MAX_VESTING_PERIODParams = FunctionArguments<typeof functions.MAX_VESTING_PERIOD>
export type MAX_VESTING_PERIODReturn = FunctionReturn<typeof functions.MAX_VESTING_PERIOD>

export type MIN_SHARESParams = FunctionArguments<typeof functions.MIN_SHARES>
export type MIN_SHARESReturn = FunctionReturn<typeof functions.MIN_SHARES>

export type REWARDER_ROLEParams = FunctionArguments<typeof functions.REWARDER_ROLE>
export type REWARDER_ROLEReturn = FunctionReturn<typeof functions.REWARDER_ROLE>

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

export type BurnAssetsParams = FunctionArguments<typeof functions.burnAssets>
export type BurnAssetsReturn = FunctionReturn<typeof functions.burnAssets>

export type CancelCooldownParams = FunctionArguments<typeof functions.cancelCooldown>
export type CancelCooldownReturn = FunctionReturn<typeof functions.cancelCooldown>

export type ConvertToAssetsParams = FunctionArguments<typeof functions.convertToAssets>
export type ConvertToAssetsReturn = FunctionReturn<typeof functions.convertToAssets>

export type ConvertToSharesParams = FunctionArguments<typeof functions.convertToShares>
export type ConvertToSharesReturn = FunctionReturn<typeof functions.convertToShares>

export type CooldownAssetsParams = FunctionArguments<typeof functions.cooldownAssets>
export type CooldownAssetsReturn = FunctionReturn<typeof functions.cooldownAssets>

export type CooldownDurationParams = FunctionArguments<typeof functions.cooldownDuration>
export type CooldownDurationReturn = FunctionReturn<typeof functions.cooldownDuration>

export type CooldownSharesParams = FunctionArguments<typeof functions.cooldownShares>
export type CooldownSharesReturn = FunctionReturn<typeof functions.cooldownShares>

export type CooldownsParams = FunctionArguments<typeof functions.cooldowns>
export type CooldownsReturn = FunctionReturn<typeof functions.cooldowns>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type Eip712DomainParams = FunctionArguments<typeof functions.eip712Domain>
export type Eip712DomainReturn = FunctionReturn<typeof functions.eip712Domain>

export type GetRoleAdminParams = FunctionArguments<typeof functions.getRoleAdmin>
export type GetRoleAdminReturn = FunctionReturn<typeof functions.getRoleAdmin>

export type GetUnvestedAmountParams = FunctionArguments<typeof functions.getUnvestedAmount>
export type GetUnvestedAmountReturn = FunctionReturn<typeof functions.getUnvestedAmount>

export type GrantRoleParams = FunctionArguments<typeof functions.grantRole>
export type GrantRoleReturn = FunctionReturn<typeof functions.grantRole>

export type HasRoleParams = FunctionArguments<typeof functions.hasRole>
export type HasRoleReturn = FunctionReturn<typeof functions.hasRole>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsBlacklistedParams = FunctionArguments<typeof functions.isBlacklisted>
export type IsBlacklistedReturn = FunctionReturn<typeof functions.isBlacklisted>

export type LastDistributionTimestampParams = FunctionArguments<typeof functions.lastDistributionTimestamp>
export type LastDistributionTimestampReturn = FunctionReturn<typeof functions.lastDistributionTimestamp>

export type MaxDepositParams = FunctionArguments<typeof functions.maxDeposit>
export type MaxDepositReturn = FunctionReturn<typeof functions.maxDeposit>

export type MaxMintParams = FunctionArguments<typeof functions.maxMint>
export type MaxMintReturn = FunctionReturn<typeof functions.maxMint>

export type MaxRedeemParams = FunctionArguments<typeof functions.maxRedeem>
export type MaxRedeemReturn = FunctionReturn<typeof functions.maxRedeem>

export type MaxWithdrawParams = FunctionArguments<typeof functions.maxWithdraw>
export type MaxWithdrawReturn = FunctionReturn<typeof functions.maxWithdraw>

export type MinSharesParams = FunctionArguments<typeof functions.minShares>
export type MinSharesReturn = FunctionReturn<typeof functions.minShares>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

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

export type PreviewRedeemParams = FunctionArguments<typeof functions.previewRedeem>
export type PreviewRedeemReturn = FunctionReturn<typeof functions.previewRedeem>

export type PreviewWithdrawParams = FunctionArguments<typeof functions.previewWithdraw>
export type PreviewWithdrawReturn = FunctionReturn<typeof functions.previewWithdraw>

export type ProxiableUUIDParams = FunctionArguments<typeof functions.proxiableUUID>
export type ProxiableUUIDReturn = FunctionReturn<typeof functions.proxiableUUID>

export type RedeemParams = FunctionArguments<typeof functions.redeem>
export type RedeemReturn = FunctionReturn<typeof functions.redeem>

export type RedistributeLockedAmountParams = FunctionArguments<typeof functions.redistributeLockedAmount>
export type RedistributeLockedAmountReturn = FunctionReturn<typeof functions.redistributeLockedAmount>

export type RemoveFromBlacklistParams = FunctionArguments<typeof functions.removeFromBlacklist>
export type RemoveFromBlacklistReturn = FunctionReturn<typeof functions.removeFromBlacklist>

export type RenounceRoleParams = FunctionArguments<typeof functions.renounceRole>
export type RenounceRoleReturn = FunctionReturn<typeof functions.renounceRole>

export type RescueTokensParams = FunctionArguments<typeof functions.rescueTokens>
export type RescueTokensReturn = FunctionReturn<typeof functions.rescueTokens>

export type RevokeRoleParams = FunctionArguments<typeof functions.revokeRole>
export type RevokeRoleReturn = FunctionReturn<typeof functions.revokeRole>

export type SetCooldownDurationParams = FunctionArguments<typeof functions.setCooldownDuration>
export type SetCooldownDurationReturn = FunctionReturn<typeof functions.setCooldownDuration>

export type SetVestingPeriodParams = FunctionArguments<typeof functions.setVestingPeriod>
export type SetVestingPeriodReturn = FunctionReturn<typeof functions.setVestingPeriod>

export type SiloParams = FunctionArguments<typeof functions.silo>
export type SiloReturn = FunctionReturn<typeof functions.silo>

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

export type TransferInRewardsParams = FunctionArguments<typeof functions.transferInRewards>
export type TransferInRewardsReturn = FunctionReturn<typeof functions.transferInRewards>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UnstakeParams = FunctionArguments<typeof functions.unstake>
export type UnstakeReturn = FunctionReturn<typeof functions.unstake>

export type UpgradeToAndCallParams = FunctionArguments<typeof functions.upgradeToAndCall>
export type UpgradeToAndCallReturn = FunctionReturn<typeof functions.upgradeToAndCall>

export type VestingAmountParams = FunctionArguments<typeof functions.vestingAmount>
export type VestingAmountReturn = FunctionReturn<typeof functions.vestingAmount>

export type VestingPeriodParams = FunctionArguments<typeof functions.vestingPeriod>
export type VestingPeriodReturn = FunctionReturn<typeof functions.vestingPeriod>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

