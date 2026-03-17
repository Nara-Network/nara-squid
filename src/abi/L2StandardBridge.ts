import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    DepositFinalized: event("0xb0444523268717a02698be47d0803aa7468c00acbed2f8bd93a0459cde61dd89", "DepositFinalized(address,address,address,address,uint256,bytes)", {"l1Token": indexed(p.address), "l2Token": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ERC20BridgeFinalized: event("0xd59c65b35445225835c83f50b6ede06a7be047d22e357073e250d9af537518cd", "ERC20BridgeFinalized(address,address,address,address,uint256,bytes)", {"localToken": indexed(p.address), "remoteToken": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ERC20BridgeInitiated: event("0x7ff126db8024424bbfd9826e8ab82ff59136289ea440b04b39a0df1b03b9cabf", "ERC20BridgeInitiated(address,address,address,address,uint256,bytes)", {"localToken": indexed(p.address), "remoteToken": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
    ETHBridgeFinalized: event("0x31b2166ff604fc5672ea5df08a78081d2bc6d746cadce880747f3643d819e83d", "ETHBridgeFinalized(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    ETHBridgeInitiated: event("0x2849b43074093a05396b6f2a937dee8565b15a48a7b3d4bffb732a5017380af5", "ETHBridgeInitiated(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256, "extraData": p.bytes}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    WithdrawalInitiated: event("0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e", "WithdrawalInitiated(address,address,address,address,uint256,bytes)", {"l1Token": indexed(p.address), "l2Token": indexed(p.address), "from": indexed(p.address), "to": p.address, "amount": p.uint256, "extraData": p.bytes}),
}

export const functions = {
    MESSENGER: viewFun("0x927ede2d", "MESSENGER()", {}, p.address),
    OTHER_BRIDGE: viewFun("0x7f46ddb2", "OTHER_BRIDGE()", {}, p.address),
    bridgeERC20: fun("0x87087623", "bridgeERC20(address,address,uint256,uint32,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeERC20To: fun("0x540abf73", "bridgeERC20To(address,address,address,uint256,uint32,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_to": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeETH: fun("0x09fc8843", "bridgeETH(uint32,bytes)", {"_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    bridgeETHTo: fun("0xe11013dd", "bridgeETHTo(address,uint32,bytes)", {"_to": p.address, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    deposits: viewFun("0x8f601f66", "deposits(address,address)", {"_0": p.address, "_1": p.address}, p.uint256),
    finalizeBridgeERC20: fun("0x0166a07a", "finalizeBridgeERC20(address,address,address,address,uint256,bytes)", {"_localToken": p.address, "_remoteToken": p.address, "_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    finalizeBridgeETH: fun("0x1635f5fd", "finalizeBridgeETH(address,address,uint256,bytes)", {"_from": p.address, "_to": p.address, "_amount": p.uint256, "_extraData": p.bytes}, ),
    initialize: fun("0xc4d66de8", "initialize(address)", {"_otherBridge": p.address}, ),
    l1TokenBridge: viewFun("0x36c717c1", "l1TokenBridge()", {}, p.address),
    messenger: viewFun("0x3cb747bf", "messenger()", {}, p.address),
    otherBridge: viewFun("0xc89701a2", "otherBridge()", {}, p.address),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    version: viewFun("0x54fd4d50", "version()", {}, p.string),
    withdraw: fun("0x32b7006d", "withdraw(address,uint256,uint32,bytes)", {"_l2Token": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
    withdrawTo: fun("0xa3a79548", "withdrawTo(address,address,uint256,uint32,bytes)", {"_l2Token": p.address, "_to": p.address, "_amount": p.uint256, "_minGasLimit": p.uint32, "_extraData": p.bytes}, ),
}

export class Contract extends ContractBase {

    MESSENGER() {
        return this.eth_call(functions.MESSENGER, {})
    }

    OTHER_BRIDGE() {
        return this.eth_call(functions.OTHER_BRIDGE, {})
    }

    deposits(_0: DepositsParams["_0"], _1: DepositsParams["_1"]) {
        return this.eth_call(functions.deposits, {_0, _1})
    }

    l1TokenBridge() {
        return this.eth_call(functions.l1TokenBridge, {})
    }

    messenger() {
        return this.eth_call(functions.messenger, {})
    }

    otherBridge() {
        return this.eth_call(functions.otherBridge, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    version() {
        return this.eth_call(functions.version, {})
    }
}

/// Event types
export type DepositFinalizedEventArgs = EParams<typeof events.DepositFinalized>
export type ERC20BridgeFinalizedEventArgs = EParams<typeof events.ERC20BridgeFinalized>
export type ERC20BridgeInitiatedEventArgs = EParams<typeof events.ERC20BridgeInitiated>
export type ETHBridgeFinalizedEventArgs = EParams<typeof events.ETHBridgeFinalized>
export type ETHBridgeInitiatedEventArgs = EParams<typeof events.ETHBridgeInitiated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type WithdrawalInitiatedEventArgs = EParams<typeof events.WithdrawalInitiated>

/// Function types
export type MESSENGERParams = FunctionArguments<typeof functions.MESSENGER>
export type MESSENGERReturn = FunctionReturn<typeof functions.MESSENGER>

export type OTHER_BRIDGEParams = FunctionArguments<typeof functions.OTHER_BRIDGE>
export type OTHER_BRIDGEReturn = FunctionReturn<typeof functions.OTHER_BRIDGE>

export type BridgeERC20Params = FunctionArguments<typeof functions.bridgeERC20>
export type BridgeERC20Return = FunctionReturn<typeof functions.bridgeERC20>

export type BridgeERC20ToParams = FunctionArguments<typeof functions.bridgeERC20To>
export type BridgeERC20ToReturn = FunctionReturn<typeof functions.bridgeERC20To>

export type BridgeETHParams = FunctionArguments<typeof functions.bridgeETH>
export type BridgeETHReturn = FunctionReturn<typeof functions.bridgeETH>

export type BridgeETHToParams = FunctionArguments<typeof functions.bridgeETHTo>
export type BridgeETHToReturn = FunctionReturn<typeof functions.bridgeETHTo>

export type DepositsParams = FunctionArguments<typeof functions.deposits>
export type DepositsReturn = FunctionReturn<typeof functions.deposits>

export type FinalizeBridgeERC20Params = FunctionArguments<typeof functions.finalizeBridgeERC20>
export type FinalizeBridgeERC20Return = FunctionReturn<typeof functions.finalizeBridgeERC20>

export type FinalizeBridgeETHParams = FunctionArguments<typeof functions.finalizeBridgeETH>
export type FinalizeBridgeETHReturn = FunctionReturn<typeof functions.finalizeBridgeETH>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type L1TokenBridgeParams = FunctionArguments<typeof functions.l1TokenBridge>
export type L1TokenBridgeReturn = FunctionReturn<typeof functions.l1TokenBridge>

export type MessengerParams = FunctionArguments<typeof functions.messenger>
export type MessengerReturn = FunctionReturn<typeof functions.messenger>

export type OtherBridgeParams = FunctionArguments<typeof functions.otherBridge>
export type OtherBridgeReturn = FunctionReturn<typeof functions.otherBridge>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type VersionParams = FunctionArguments<typeof functions.version>
export type VersionReturn = FunctionReturn<typeof functions.version>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawToParams = FunctionArguments<typeof functions.withdrawTo>
export type WithdrawToReturn = FunctionReturn<typeof functions.withdrawTo>

