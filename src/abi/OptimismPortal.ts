import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    TransactionDeposited: event("0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32", "TransactionDeposited(address,address,uint256,bytes)", {"from": indexed(p.address), "to": indexed(p.address), "version": indexed(p.uint256), "opaqueData": p.bytes}),
    WithdrawalFinalized: event("0xdb5c7652857aa163daadd670e116628fb42e869d8ac4251ef8971d9e5727df1b", "WithdrawalFinalized(bytes32,bool)", {"withdrawalHash": indexed(p.bytes32), "success": p.bool}),
    WithdrawalProven: event("0x67a6208cfcc0801d50f6cbe764733f4fddf66ac0b04442061a8a8c0cb6b63f62", "WithdrawalProven(bytes32,address,address)", {"withdrawalHash": indexed(p.bytes32), "from": indexed(p.address), "to": indexed(p.address)}),
}

export const functions = {
    balance: viewFun("0xb69ef8a8", "balance()", {}, p.uint256),
    depositERC20Transaction: fun("0x149f2f22", "depositERC20Transaction(address,uint256,uint256,uint64,bool,bytes)", {"_to": p.address, "_mint": p.uint256, "_value": p.uint256, "_gasLimit": p.uint64, "_isCreation": p.bool, "_data": p.bytes}, ),
    depositTransaction: fun("0xe9e05c42", "depositTransaction(address,uint256,uint64,bool,bytes)", {"_to": p.address, "_value": p.uint256, "_gasLimit": p.uint64, "_isCreation": p.bool, "_data": p.bytes}, ),
    donateETH: fun("0x8b4c40b0", "donateETH()", {}, ),
    finalizeWithdrawalTransaction: fun("0x8c3152e9", "finalizeWithdrawalTransaction((uint256,address,address,uint256,uint256,bytes))", {"_tx": p.struct({"nonce": p.uint256, "sender": p.address, "target": p.address, "value": p.uint256, "gasLimit": p.uint256, "data": p.bytes})}, ),
    finalizedWithdrawals: viewFun("0xa14238e7", "finalizedWithdrawals(bytes32)", {"_0": p.bytes32}, p.bool),
    guardian: viewFun("0x452a9320", "guardian()", {}, p.address),
    initialize: fun("0xc0c53b8b", "initialize(address,address,address)", {"_l2Oracle": p.address, "_systemConfig": p.address, "_superchainConfig": p.address}, ),
    isOutputFinalized: viewFun("0x6dbffb78", "isOutputFinalized(uint256)", {"_l2OutputIndex": p.uint256}, p.bool),
    l2Oracle: viewFun("0x9b5f694a", "l2Oracle()", {}, p.address),
    l2Sender: viewFun("0x9bf62d82", "l2Sender()", {}, p.address),
    minimumGasLimit: viewFun("0xa35d99df", "minimumGasLimit(uint64)", {"_byteCount": p.uint64}, p.uint64),
    params: viewFun("0xcff0ab96", "params()", {}, {"prevBaseFee": p.uint128, "prevBoughtGas": p.uint64, "prevBlockNum": p.uint64}),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    proveWithdrawalTransaction: fun("0x4870496f", "proveWithdrawalTransaction((uint256,address,address,uint256,uint256,bytes),uint256,(bytes32,bytes32,bytes32,bytes32),bytes[])", {"_tx": p.struct({"nonce": p.uint256, "sender": p.address, "target": p.address, "value": p.uint256, "gasLimit": p.uint256, "data": p.bytes}), "_l2OutputIndex": p.uint256, "_outputRootProof": p.struct({"version": p.bytes32, "stateRoot": p.bytes32, "messagePasserStorageRoot": p.bytes32, "latestBlockhash": p.bytes32}), "_withdrawalProof": p.array(p.bytes)}, ),
    provenWithdrawals: viewFun("0xe965084c", "provenWithdrawals(bytes32)", {"_0": p.bytes32}, {"outputRoot": p.bytes32, "timestamp": p.uint128, "l2OutputIndex": p.uint128}),
    setGasPayingToken: fun("0x71cfaa3f", "setGasPayingToken(address,uint8,bytes32,bytes32)", {"_token": p.address, "_decimals": p.uint8, "_name": p.bytes32, "_symbol": p.bytes32}, ),
    superchainConfig: viewFun("0x35e80ab3", "superchainConfig()", {}, p.address),
    systemConfig: viewFun("0x33d7e2bd", "systemConfig()", {}, p.address),
    version: viewFun("0x54fd4d50", "version()", {}, p.string),
}

export class Contract extends ContractBase {

    balance() {
        return this.eth_call(functions.balance, {})
    }

    finalizedWithdrawals(_0: FinalizedWithdrawalsParams["_0"]) {
        return this.eth_call(functions.finalizedWithdrawals, {_0})
    }

    guardian() {
        return this.eth_call(functions.guardian, {})
    }

    isOutputFinalized(_l2OutputIndex: IsOutputFinalizedParams["_l2OutputIndex"]) {
        return this.eth_call(functions.isOutputFinalized, {_l2OutputIndex})
    }

    l2Oracle() {
        return this.eth_call(functions.l2Oracle, {})
    }

    l2Sender() {
        return this.eth_call(functions.l2Sender, {})
    }

    minimumGasLimit(_byteCount: MinimumGasLimitParams["_byteCount"]) {
        return this.eth_call(functions.minimumGasLimit, {_byteCount})
    }

    params() {
        return this.eth_call(functions.params, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    provenWithdrawals(_0: ProvenWithdrawalsParams["_0"]) {
        return this.eth_call(functions.provenWithdrawals, {_0})
    }

    superchainConfig() {
        return this.eth_call(functions.superchainConfig, {})
    }

    systemConfig() {
        return this.eth_call(functions.systemConfig, {})
    }

    version() {
        return this.eth_call(functions.version, {})
    }
}

/// Event types
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type TransactionDepositedEventArgs = EParams<typeof events.TransactionDeposited>
export type WithdrawalFinalizedEventArgs = EParams<typeof events.WithdrawalFinalized>
export type WithdrawalProvenEventArgs = EParams<typeof events.WithdrawalProven>

/// Function types
export type BalanceParams = FunctionArguments<typeof functions.balance>
export type BalanceReturn = FunctionReturn<typeof functions.balance>

export type DepositERC20TransactionParams = FunctionArguments<typeof functions.depositERC20Transaction>
export type DepositERC20TransactionReturn = FunctionReturn<typeof functions.depositERC20Transaction>

export type DepositTransactionParams = FunctionArguments<typeof functions.depositTransaction>
export type DepositTransactionReturn = FunctionReturn<typeof functions.depositTransaction>

export type DonateETHParams = FunctionArguments<typeof functions.donateETH>
export type DonateETHReturn = FunctionReturn<typeof functions.donateETH>

export type FinalizeWithdrawalTransactionParams = FunctionArguments<typeof functions.finalizeWithdrawalTransaction>
export type FinalizeWithdrawalTransactionReturn = FunctionReturn<typeof functions.finalizeWithdrawalTransaction>

export type FinalizedWithdrawalsParams = FunctionArguments<typeof functions.finalizedWithdrawals>
export type FinalizedWithdrawalsReturn = FunctionReturn<typeof functions.finalizedWithdrawals>

export type GuardianParams = FunctionArguments<typeof functions.guardian>
export type GuardianReturn = FunctionReturn<typeof functions.guardian>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsOutputFinalizedParams = FunctionArguments<typeof functions.isOutputFinalized>
export type IsOutputFinalizedReturn = FunctionReturn<typeof functions.isOutputFinalized>

export type L2OracleParams = FunctionArguments<typeof functions.l2Oracle>
export type L2OracleReturn = FunctionReturn<typeof functions.l2Oracle>

export type L2SenderParams = FunctionArguments<typeof functions.l2Sender>
export type L2SenderReturn = FunctionReturn<typeof functions.l2Sender>

export type MinimumGasLimitParams = FunctionArguments<typeof functions.minimumGasLimit>
export type MinimumGasLimitReturn = FunctionReturn<typeof functions.minimumGasLimit>

export type ParamsParams = FunctionArguments<typeof functions.params>
export type ParamsReturn = FunctionReturn<typeof functions.params>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type ProveWithdrawalTransactionParams = FunctionArguments<typeof functions.proveWithdrawalTransaction>
export type ProveWithdrawalTransactionReturn = FunctionReturn<typeof functions.proveWithdrawalTransaction>

export type ProvenWithdrawalsParams = FunctionArguments<typeof functions.provenWithdrawals>
export type ProvenWithdrawalsReturn = FunctionReturn<typeof functions.provenWithdrawals>

export type SetGasPayingTokenParams = FunctionArguments<typeof functions.setGasPayingToken>
export type SetGasPayingTokenReturn = FunctionReturn<typeof functions.setGasPayingToken>

export type SuperchainConfigParams = FunctionArguments<typeof functions.superchainConfig>
export type SuperchainConfigReturn = FunctionReturn<typeof functions.superchainConfig>

export type SystemConfigParams = FunctionArguments<typeof functions.systemConfig>
export type SystemConfigReturn = FunctionReturn<typeof functions.systemConfig>

export type VersionParams = FunctionArguments<typeof functions.version>
export type VersionReturn = FunctionReturn<typeof functions.version>

