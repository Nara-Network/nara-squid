import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    MessagePassed: event("0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054", "MessagePassed(uint256,address,address,uint256,uint256,bytes,bytes32)", {"nonce": indexed(p.uint256), "sender": indexed(p.address), "target": indexed(p.address), "value": p.uint256, "gasLimit": p.uint256, "data": p.bytes, "withdrawalHash": p.bytes32}),
    WithdrawerBalanceBurnt: event("0x7967de617a5ac1cc7eba2d6f37570a0135afa950d8bb77cdd35f0d0b4e85a16f", "WithdrawerBalanceBurnt(uint256)", {"amount": indexed(p.uint256)}),
}

export const functions = {
    MESSAGE_VERSION: viewFun("0x3f827a5a", "MESSAGE_VERSION()", {}, p.uint16),
    burn: fun("0x44df8e70", "burn()", {}, ),
    initiateWithdrawal: fun("0xc2b3e5ac", "initiateWithdrawal(address,uint256,bytes)", {"_target": p.address, "_gasLimit": p.uint256, "_data": p.bytes}, ),
    messageNonce: viewFun("0xecc70428", "messageNonce()", {}, p.uint256),
    sentMessages: viewFun("0x82e3702d", "sentMessages(bytes32)", {"_0": p.bytes32}, p.bool),
    version: viewFun("0x54fd4d50", "version()", {}, p.string),
}

export class Contract extends ContractBase {

    MESSAGE_VERSION() {
        return this.eth_call(functions.MESSAGE_VERSION, {})
    }

    messageNonce() {
        return this.eth_call(functions.messageNonce, {})
    }

    sentMessages(_0: SentMessagesParams["_0"]) {
        return this.eth_call(functions.sentMessages, {_0})
    }

    version() {
        return this.eth_call(functions.version, {})
    }
}

/// Event types
export type MessagePassedEventArgs = EParams<typeof events.MessagePassed>
export type WithdrawerBalanceBurntEventArgs = EParams<typeof events.WithdrawerBalanceBurnt>

/// Function types
export type MESSAGE_VERSIONParams = FunctionArguments<typeof functions.MESSAGE_VERSION>
export type MESSAGE_VERSIONReturn = FunctionReturn<typeof functions.MESSAGE_VERSION>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type InitiateWithdrawalParams = FunctionArguments<typeof functions.initiateWithdrawal>
export type InitiateWithdrawalReturn = FunctionReturn<typeof functions.initiateWithdrawal>

export type MessageNonceParams = FunctionArguments<typeof functions.messageNonce>
export type MessageNonceReturn = FunctionReturn<typeof functions.messageNonce>

export type SentMessagesParams = FunctionArguments<typeof functions.sentMessages>
export type SentMessagesReturn = FunctionReturn<typeof functions.sentMessages>

export type VersionParams = FunctionArguments<typeof functions.version>
export type VersionReturn = FunctionReturn<typeof functions.version>

