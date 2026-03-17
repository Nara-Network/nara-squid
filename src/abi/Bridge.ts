import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AllowlistSet: event("0xff571df7d74779bb3bc4c418144ed2539441681cec39b558e6639f5faefc0695", "AllowlistSet(address,bool)", {"_coin": indexed(p.address), "_set": p.bool}),
    BridgeDeposit: event("0xe6d569988a657bfe192b57e0db4d30aca1e89954ed3b541583657f257962f3d3", "BridgeDeposit(address,uint256,address,address)", {"_stablecoin": indexed(p.address), "_amount": p.uint256, "_from": indexed(p.address), "_to": indexed(p.address)}),
    DepositCapSet: event("0x5346dfddf35b6b3adb49f21161904a305a764ba435dfad799dfef4be25607140", "DepositCapSet(address,uint256)", {"_coin": indexed(p.address), "_newDepositCap": p.uint256}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    WithdrawCoins: event("0x357881803726314b1aa89205d7155af64a04e44003792bc2995d16e404513dce", "WithdrawCoins(address,uint256,address)", {"_coin": indexed(p.address), "_amount": p.uint256, "_to": indexed(p.address)}),
}

export const functions = {
    allowlisted: viewFun("0x03f45d41", "allowlisted(address)", {"_0": p.address}, p.bool),
    bridge: fun("0x530a530b", "bridge(address,uint256,address,bytes)", {"_stablecoin": p.address, "_amount": p.uint256, "_to": p.address, "_extraData": p.bytes}, ),
    depositCap: viewFun("0x20b71534", "depositCap(address)", {"_0": p.address}, p.uint256),
    gasLimit: viewFun("0xf68016b7", "gasLimit()", {}, p.uint32),
    l1USDX: viewFun("0xb7d9e1d4", "l1USDX()", {}, p.address),
    l2USDX: viewFun("0xfedc99ca", "l2USDX()", {}, p.address),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setAllowlist: fun("0xb12527f8", "setAllowlist(address,bool)", {"_stablecoin": p.address, "_set": p.bool}, ),
    setDepositCap: fun("0xf878369e", "setDepositCap(address,uint256)", {"_stablecoin": p.address, "_newDepositCap": p.uint256}, ),
    standardBridge: viewFun("0x354fe6a6", "standardBridge()", {}, p.address),
    totalBridged: viewFun("0x082568d0", "totalBridged(address)", {"_0": p.address}, p.uint256),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    withdrawERC20: fun("0xa1db9782", "withdrawERC20(address,uint256)", {"_coin": p.address, "_amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    allowlisted(_0: AllowlistedParams["_0"]) {
        return this.eth_call(functions.allowlisted, {_0})
    }

    depositCap(_0: DepositCapParams["_0"]) {
        return this.eth_call(functions.depositCap, {_0})
    }

    gasLimit() {
        return this.eth_call(functions.gasLimit, {})
    }

    l1USDX() {
        return this.eth_call(functions.l1USDX, {})
    }

    l2USDX() {
        return this.eth_call(functions.l2USDX, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    standardBridge() {
        return this.eth_call(functions.standardBridge, {})
    }

    totalBridged(_0: TotalBridgedParams["_0"]) {
        return this.eth_call(functions.totalBridged, {_0})
    }
}

/// Event types
export type AllowlistSetEventArgs = EParams<typeof events.AllowlistSet>
export type BridgeDepositEventArgs = EParams<typeof events.BridgeDeposit>
export type DepositCapSetEventArgs = EParams<typeof events.DepositCapSet>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type WithdrawCoinsEventArgs = EParams<typeof events.WithdrawCoins>

/// Function types
export type AllowlistedParams = FunctionArguments<typeof functions.allowlisted>
export type AllowlistedReturn = FunctionReturn<typeof functions.allowlisted>

export type BridgeParams = FunctionArguments<typeof functions.bridge>
export type BridgeReturn = FunctionReturn<typeof functions.bridge>

export type DepositCapParams = FunctionArguments<typeof functions.depositCap>
export type DepositCapReturn = FunctionReturn<typeof functions.depositCap>

export type GasLimitParams = FunctionArguments<typeof functions.gasLimit>
export type GasLimitReturn = FunctionReturn<typeof functions.gasLimit>

export type L1USDXParams = FunctionArguments<typeof functions.l1USDX>
export type L1USDXReturn = FunctionReturn<typeof functions.l1USDX>

export type L2USDXParams = FunctionArguments<typeof functions.l2USDX>
export type L2USDXReturn = FunctionReturn<typeof functions.l2USDX>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetAllowlistParams = FunctionArguments<typeof functions.setAllowlist>
export type SetAllowlistReturn = FunctionReturn<typeof functions.setAllowlist>

export type SetDepositCapParams = FunctionArguments<typeof functions.setDepositCap>
export type SetDepositCapReturn = FunctionReturn<typeof functions.setDepositCap>

export type StandardBridgeParams = FunctionArguments<typeof functions.standardBridge>
export type StandardBridgeReturn = FunctionReturn<typeof functions.standardBridge>

export type TotalBridgedParams = FunctionArguments<typeof functions.totalBridged>
export type TotalBridgedReturn = FunctionReturn<typeof functions.totalBridged>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type WithdrawERC20Params = FunctionArguments<typeof functions.withdrawERC20>
export type WithdrawERC20Return = FunctionReturn<typeof functions.withdrawERC20>

