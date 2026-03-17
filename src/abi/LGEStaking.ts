import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AllowlistSet: event("0xff571df7d74779bb3bc4c418144ed2539441681cec39b558e6639f5faefc0695", "AllowlistSet(address,bool)", {"_coin": indexed(p.address), "_set": p.bool}),
    Deposit: event("0xe31c7b8d08ee7db0afa68782e1028ef92305caeea8626633ad44d413e30f6b2f", "Deposit(address,uint256,address)", {"_token": indexed(p.address), "_amount": p.uint256, "_to": indexed(p.address)}),
    DepositCapSet: event("0x5346dfddf35b6b3adb49f21161904a305a764ba435dfad799dfef4be25607140", "DepositCapSet(address,uint256)", {"_coin": indexed(p.address), "_newDepositCap": p.uint256}),
    MigrationContractSet: event("0x97a236cf3b4e32c9fb4e33b5edcb52a89e62617e6f0832e3af28a0c3ecb3028f", "MigrationContractSet(address)", {"_newContract": p.address}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    TokensMigrated: event("0xf9b1215494e89a3abef4052b34e4a3ad50d1729ae40b81e1132f83577e5637fb", "TokensMigrated(address,address,address[],uint256[])", {"_user": indexed(p.address), "_l2Destination": indexed(p.address), "_tokens": p.array(p.address), "_amounts": p.array(p.uint256)}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
    Withdraw: event("0x56c54ba9bd38d8fd62012e42c7ee564519b09763c426d331b3661b537ead19b2", "Withdraw(address,uint256,address)", {"_token": indexed(p.address), "_amount": p.uint256, "_to": indexed(p.address)}),
}

export const functions = {
    allowlisted: viewFun("0x03f45d41", "allowlisted(address)", {"_0": p.address}, p.bool),
    balance: viewFun("0xb203bb99", "balance(address,address)", {"_0": p.address, "_1": p.address}, p.uint256),
    depositCap: viewFun("0x20b71534", "depositCap(address)", {"_0": p.address}, p.uint256),
    depositERC20: fun("0x97feb926", "depositERC20(address,uint256)", {"_token": p.address, "_amount": p.uint256}, ),
    depositETH: fun("0xf6326fb3", "depositETH()", {}, ),
    lgeMigration: viewFun("0xcd152fb5", "lgeMigration()", {}, p.address),
    migrate: fun("0x047701e4", "migrate(address,address[])", {"_l2Destination": p.address, "_tokens": p.array(p.address)}, ),
    migrationActivated: viewFun("0xd7d4cf09", "migrationActivated()", {}, p.bool),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setAllowlist: fun("0xb12527f8", "setAllowlist(address,bool)", {"_token": p.address, "_set": p.bool}, ),
    setDepositCap: fun("0xf878369e", "setDepositCap(address,uint256)", {"_token": p.address, "_newDepositCap": p.uint256}, ),
    setMigrationContract: fun("0x88b79cec", "setMigrationContract(address)", {"_contract": p.address}, ),
    setPaused: fun("0x16c38b3c", "setPaused(bool)", {"_set": p.bool}, ),
    stETH: viewFun("0xc1fe3e48", "stETH()", {}, p.address),
    totalDeposited: viewFun("0x53055481", "totalDeposited(address)", {"_0": p.address}, p.uint256),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    version: viewFun("0x54fd4d50", "version()", {}, p.string),
    withdraw: fun("0xf3fef3a3", "withdraw(address,uint256)", {"_token": p.address, "_amount": p.uint256}, ),
    wstETH: viewFun("0x4aa07e64", "wstETH()", {}, p.address),
}

export class Contract extends ContractBase {

    allowlisted(_0: AllowlistedParams["_0"]) {
        return this.eth_call(functions.allowlisted, {_0})
    }

    balance(_0: BalanceParams["_0"], _1: BalanceParams["_1"]) {
        return this.eth_call(functions.balance, {_0, _1})
    }

    depositCap(_0: DepositCapParams["_0"]) {
        return this.eth_call(functions.depositCap, {_0})
    }

    lgeMigration() {
        return this.eth_call(functions.lgeMigration, {})
    }

    migrationActivated() {
        return this.eth_call(functions.migrationActivated, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    stETH() {
        return this.eth_call(functions.stETH, {})
    }

    totalDeposited(_0: TotalDepositedParams["_0"]) {
        return this.eth_call(functions.totalDeposited, {_0})
    }

    version() {
        return this.eth_call(functions.version, {})
    }

    wstETH() {
        return this.eth_call(functions.wstETH, {})
    }
}

/// Event types
export type AllowlistSetEventArgs = EParams<typeof events.AllowlistSet>
export type DepositEventArgs = EParams<typeof events.Deposit>
export type DepositCapSetEventArgs = EParams<typeof events.DepositCapSet>
export type MigrationContractSetEventArgs = EParams<typeof events.MigrationContractSet>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type TokensMigratedEventArgs = EParams<typeof events.TokensMigrated>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>

/// Function types
export type AllowlistedParams = FunctionArguments<typeof functions.allowlisted>
export type AllowlistedReturn = FunctionReturn<typeof functions.allowlisted>

export type BalanceParams = FunctionArguments<typeof functions.balance>
export type BalanceReturn = FunctionReturn<typeof functions.balance>

export type DepositCapParams = FunctionArguments<typeof functions.depositCap>
export type DepositCapReturn = FunctionReturn<typeof functions.depositCap>

export type DepositERC20Params = FunctionArguments<typeof functions.depositERC20>
export type DepositERC20Return = FunctionReturn<typeof functions.depositERC20>

export type DepositETHParams = FunctionArguments<typeof functions.depositETH>
export type DepositETHReturn = FunctionReturn<typeof functions.depositETH>

export type LgeMigrationParams = FunctionArguments<typeof functions.lgeMigration>
export type LgeMigrationReturn = FunctionReturn<typeof functions.lgeMigration>

export type MigrateParams = FunctionArguments<typeof functions.migrate>
export type MigrateReturn = FunctionReturn<typeof functions.migrate>

export type MigrationActivatedParams = FunctionArguments<typeof functions.migrationActivated>
export type MigrationActivatedReturn = FunctionReturn<typeof functions.migrationActivated>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetAllowlistParams = FunctionArguments<typeof functions.setAllowlist>
export type SetAllowlistReturn = FunctionReturn<typeof functions.setAllowlist>

export type SetDepositCapParams = FunctionArguments<typeof functions.setDepositCap>
export type SetDepositCapReturn = FunctionReturn<typeof functions.setDepositCap>

export type SetMigrationContractParams = FunctionArguments<typeof functions.setMigrationContract>
export type SetMigrationContractReturn = FunctionReturn<typeof functions.setMigrationContract>

export type SetPausedParams = FunctionArguments<typeof functions.setPaused>
export type SetPausedReturn = FunctionReturn<typeof functions.setPaused>

export type StETHParams = FunctionArguments<typeof functions.stETH>
export type StETHReturn = FunctionReturn<typeof functions.stETH>

export type TotalDepositedParams = FunctionArguments<typeof functions.totalDeposited>
export type TotalDepositedReturn = FunctionReturn<typeof functions.totalDeposited>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type VersionParams = FunctionArguments<typeof functions.version>
export type VersionReturn = FunctionReturn<typeof functions.version>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WstETHParams = FunctionArguments<typeof functions.wstETH>
export type WstETHReturn = FunctionReturn<typeof functions.wstETH>

