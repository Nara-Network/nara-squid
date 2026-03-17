import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    GasSet: event("0xc3de732a98b24a2b5c6f67e8a7fb057ffc14046b83968a2c73e4148d2fba978b", "GasSet(uint32,uint256)", {"domain": p.uint32, "gas": p.uint256}),
    HookSet: event("0x4eab7b127c764308788622363ad3e9532de3dfba7845bd4f84c125a22544255a", "HookSet(address)", {"_hook": p.address}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    IsmSet: event("0xc47cbcc588c67679e52261c45cc315e56562f8d0ccaba16facb9093ff9498799", "IsmSet(address)", {"_ism": p.address}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    ReceivedTransferRemote: event("0xba20947a325f450d232530e5f5fce293e7963499d5309a07cee84a269f2f15a6", "ReceivedTransferRemote(uint32,bytes32,uint256)", {"origin": indexed(p.uint32), "recipient": indexed(p.bytes32), "amount": p.uint256}),
    SentTransferRemote: event("0xd229aacb94204188fe8042965fa6b269c62dc5818b21238779ab64bdd17efeec", "SentTransferRemote(uint32,bytes32,uint256)", {"destination": indexed(p.uint32), "recipient": indexed(p.bytes32), "amount": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
}

export const functions = {
    PACKAGE_VERSION: viewFun("0x93c44847", "PACKAGE_VERSION()", {}, p.string),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "amount": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"_account": p.address}, p.uint256),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    decreaseAllowance: fun("0xa457c2d7", "decreaseAllowance(address,uint256)", {"spender": p.address, "subtractedValue": p.uint256}, p.bool),
    destinationGas: viewFun("0x775313a1", "destinationGas(uint32)", {"_0": p.uint32}, p.uint256),
    domains: viewFun("0x440df4f4", "domains()", {}, p.array(p.uint32)),
    enrollRemoteRouter: fun("0xb49c53a7", "enrollRemoteRouter(uint32,bytes32)", {"_domain": p.uint32, "_router": p.bytes32}, ),
    enrollRemoteRouters: fun("0xe9198bf9", "enrollRemoteRouters(uint32[],bytes32[])", {"_domains": p.array(p.uint32), "_addresses": p.array(p.bytes32)}, ),
    handle: fun("0x56d5d475", "handle(uint32,bytes32,bytes)", {"_origin": p.uint32, "_sender": p.bytes32, "_message": p.bytes}, ),
    hook: viewFun("0x7f5a7c7b", "hook()", {}, p.address),
    increaseAllowance: fun("0x39509351", "increaseAllowance(address,uint256)", {"spender": p.address, "addedValue": p.uint256}, p.bool),
    initialize: fun("0xe80a7c79", "initialize(uint256,string,string,address,address,address)", {"_totalSupply": p.uint256, "_name": p.string, "_symbol": p.string, "_hook": p.address, "_interchainSecurityModule": p.address, "_owner": p.address}, ),
    interchainSecurityModule: viewFun("0xde523cf3", "interchainSecurityModule()", {}, p.address),
    localDomain: viewFun("0x8d3638f4", "localDomain()", {}, p.uint32),
    mailbox: viewFun("0xd5438eae", "mailbox()", {}, p.address),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    quoteGasPayment: viewFun("0xf2ed8c53", "quoteGasPayment(uint32)", {"_destinationDomain": p.uint32}, p.uint256),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    routers: viewFun("0x2ead72f6", "routers(uint32)", {"_domain": p.uint32}, p.bytes32),
    scale: viewFun("0xf51e181a", "scale()", {}, p.uint256),
    'setDestinationGas(uint32,uint256)': fun("0x49d462ef", "setDestinationGas(uint32,uint256)", {"domain": p.uint32, "gas": p.uint256}, ),
    'setDestinationGas((uint32,uint256)[])': fun("0xb1bd6436", "setDestinationGas((uint32,uint256)[])", {"gasConfigs": p.array(p.struct({"domain": p.uint32, "gas": p.uint256}))}, ),
    setHook: fun("0x3dfd3873", "setHook(address)", {"_hook": p.address}, ),
    setInterchainSecurityModule: fun("0x0e72cc06", "setInterchainSecurityModule(address)", {"_module": p.address}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "amount": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "amount": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    'transferRemote(uint32,bytes32,uint256,bytes,address)': fun("0x51debffc", "transferRemote(uint32,bytes32,uint256,bytes,address)", {"_destination": p.uint32, "_recipient": p.bytes32, "_amountOrId": p.uint256, "_hookMetadata": p.bytes, "_hook": p.address}, p.bytes32),
    'transferRemote(uint32,bytes32,uint256)': fun("0x81b4e8b4", "transferRemote(uint32,bytes32,uint256)", {"_destination": p.uint32, "_recipient": p.bytes32, "_amountOrId": p.uint256}, p.bytes32),
    unenrollRemoteRouter: fun("0xefae508a", "unenrollRemoteRouter(uint32)", {"_domain": p.uint32}, ),
    unenrollRemoteRouters: fun("0x71a15b38", "unenrollRemoteRouters(uint32[])", {"_domains": p.array(p.uint32)}, ),
}

export class Contract extends ContractBase {

    PACKAGE_VERSION() {
        return this.eth_call(functions.PACKAGE_VERSION, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(_account: BalanceOfParams["_account"]) {
        return this.eth_call(functions.balanceOf, {_account})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    destinationGas(_0: DestinationGasParams["_0"]) {
        return this.eth_call(functions.destinationGas, {_0})
    }

    domains() {
        return this.eth_call(functions.domains, {})
    }

    hook() {
        return this.eth_call(functions.hook, {})
    }

    interchainSecurityModule() {
        return this.eth_call(functions.interchainSecurityModule, {})
    }

    localDomain() {
        return this.eth_call(functions.localDomain, {})
    }

    mailbox() {
        return this.eth_call(functions.mailbox, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    quoteGasPayment(_destinationDomain: QuoteGasPaymentParams["_destinationDomain"]) {
        return this.eth_call(functions.quoteGasPayment, {_destinationDomain})
    }

    routers(_domain: RoutersParams["_domain"]) {
        return this.eth_call(functions.routers, {_domain})
    }

    scale() {
        return this.eth_call(functions.scale, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type GasSetEventArgs = EParams<typeof events.GasSet>
export type HookSetEventArgs = EParams<typeof events.HookSet>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type IsmSetEventArgs = EParams<typeof events.IsmSet>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type ReceivedTransferRemoteEventArgs = EParams<typeof events.ReceivedTransferRemote>
export type SentTransferRemoteEventArgs = EParams<typeof events.SentTransferRemote>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type PACKAGE_VERSIONParams = FunctionArguments<typeof functions.PACKAGE_VERSION>
export type PACKAGE_VERSIONReturn = FunctionReturn<typeof functions.PACKAGE_VERSION>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DecreaseAllowanceParams = FunctionArguments<typeof functions.decreaseAllowance>
export type DecreaseAllowanceReturn = FunctionReturn<typeof functions.decreaseAllowance>

export type DestinationGasParams = FunctionArguments<typeof functions.destinationGas>
export type DestinationGasReturn = FunctionReturn<typeof functions.destinationGas>

export type DomainsParams = FunctionArguments<typeof functions.domains>
export type DomainsReturn = FunctionReturn<typeof functions.domains>

export type EnrollRemoteRouterParams = FunctionArguments<typeof functions.enrollRemoteRouter>
export type EnrollRemoteRouterReturn = FunctionReturn<typeof functions.enrollRemoteRouter>

export type EnrollRemoteRoutersParams = FunctionArguments<typeof functions.enrollRemoteRouters>
export type EnrollRemoteRoutersReturn = FunctionReturn<typeof functions.enrollRemoteRouters>

export type HandleParams = FunctionArguments<typeof functions.handle>
export type HandleReturn = FunctionReturn<typeof functions.handle>

export type HookParams = FunctionArguments<typeof functions.hook>
export type HookReturn = FunctionReturn<typeof functions.hook>

export type IncreaseAllowanceParams = FunctionArguments<typeof functions.increaseAllowance>
export type IncreaseAllowanceReturn = FunctionReturn<typeof functions.increaseAllowance>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type InterchainSecurityModuleParams = FunctionArguments<typeof functions.interchainSecurityModule>
export type InterchainSecurityModuleReturn = FunctionReturn<typeof functions.interchainSecurityModule>

export type LocalDomainParams = FunctionArguments<typeof functions.localDomain>
export type LocalDomainReturn = FunctionReturn<typeof functions.localDomain>

export type MailboxParams = FunctionArguments<typeof functions.mailbox>
export type MailboxReturn = FunctionReturn<typeof functions.mailbox>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type QuoteGasPaymentParams = FunctionArguments<typeof functions.quoteGasPayment>
export type QuoteGasPaymentReturn = FunctionReturn<typeof functions.quoteGasPayment>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type RoutersParams = FunctionArguments<typeof functions.routers>
export type RoutersReturn = FunctionReturn<typeof functions.routers>

export type ScaleParams = FunctionArguments<typeof functions.scale>
export type ScaleReturn = FunctionReturn<typeof functions.scale>

export type SetDestinationGasParams_0 = FunctionArguments<typeof functions['setDestinationGas(uint32,uint256)']>
export type SetDestinationGasReturn_0 = FunctionReturn<typeof functions['setDestinationGas(uint32,uint256)']>

export type SetDestinationGasParams_1 = FunctionArguments<typeof functions['setDestinationGas((uint32,uint256)[])']>
export type SetDestinationGasReturn_1 = FunctionReturn<typeof functions['setDestinationGas((uint32,uint256)[])']>

export type SetHookParams = FunctionArguments<typeof functions.setHook>
export type SetHookReturn = FunctionReturn<typeof functions.setHook>

export type SetInterchainSecurityModuleParams = FunctionArguments<typeof functions.setInterchainSecurityModule>
export type SetInterchainSecurityModuleReturn = FunctionReturn<typeof functions.setInterchainSecurityModule>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type TransferRemoteParams_0 = FunctionArguments<typeof functions['transferRemote(uint32,bytes32,uint256,bytes,address)']>
export type TransferRemoteReturn_0 = FunctionReturn<typeof functions['transferRemote(uint32,bytes32,uint256,bytes,address)']>

export type TransferRemoteParams_1 = FunctionArguments<typeof functions['transferRemote(uint32,bytes32,uint256)']>
export type TransferRemoteReturn_1 = FunctionReturn<typeof functions['transferRemote(uint32,bytes32,uint256)']>

export type UnenrollRemoteRouterParams = FunctionArguments<typeof functions.unenrollRemoteRouter>
export type UnenrollRemoteRouterReturn = FunctionReturn<typeof functions.unenrollRemoteRouter>

export type UnenrollRemoteRoutersParams = FunctionArguments<typeof functions.unenrollRemoteRouters>
export type UnenrollRemoteRoutersReturn = FunctionReturn<typeof functions.unenrollRemoteRouters>

