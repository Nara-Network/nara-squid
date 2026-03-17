import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    DefaultHookSet: event("0x65a63e5066ee2fcdf9d32a7f1bf7ce71c76066f19d0609dddccd334ab87237d7", "DefaultHookSet(address)", {"hook": indexed(p.address)}),
    DefaultIsmSet: event("0xa76ad0adbf45318f8633aa0210f711273d50fbb6fef76ed95bbae97082c75daa", "DefaultIsmSet(address)", {"module": indexed(p.address)}),
    Dispatch: event("0x769f711d20c679153d382254f59892613b58a97cc876b249134ac25c80f9c814", "Dispatch(address,uint32,bytes32,bytes)", {"sender": indexed(p.address), "destination": indexed(p.uint32), "recipient": indexed(p.bytes32), "message": p.bytes}),
    DispatchId: event("0x788dbc1b7152732178210e7f4d9d010ef016f9eafbe66786bd7169f56e0c353a", "DispatchId(bytes32)", {"messageId": indexed(p.bytes32)}),
    Initialized: event("0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498", "Initialized(uint8)", {"version": p.uint8}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Process: event("0x0d381c2a574ae8f04e213db7cfb4df8df712cdbd427d9868ffef380660ca6574", "Process(uint32,bytes32,address)", {"origin": indexed(p.uint32), "sender": indexed(p.bytes32), "recipient": indexed(p.address)}),
    ProcessId: event("0x1cae38cdd3d3919489272725a5ae62a4f48b2989b0dae843d3c279fee18073a9", "ProcessId(bytes32)", {"messageId": indexed(p.bytes32)}),
    RequiredHookSet: event("0x329ec8e2438a73828ecf31a6568d7a91d7b1d79e342b0692914fd053d1a002b1", "RequiredHookSet(address)", {"hook": indexed(p.address)}),
}

export const functions = {
    PACKAGE_VERSION: viewFun("0x93c44847", "PACKAGE_VERSION()", {}, p.string),
    VERSION: viewFun("0xffa1ad74", "VERSION()", {}, p.uint8),
    defaultHook: viewFun("0x3d1250b7", "defaultHook()", {}, p.address),
    defaultIsm: viewFun("0x6e5f516e", "defaultIsm()", {}, p.address),
    delivered: viewFun("0xe495f1d4", "delivered(bytes32)", {"_id": p.bytes32}, p.bool),
    deployedBlock: viewFun("0x82ea7bfe", "deployedBlock()", {}, p.uint256),
    'dispatch(uint32,bytes32,bytes,bytes,address)': fun("0x10b83dc0", "dispatch(uint32,bytes32,bytes,bytes,address)", {"destinationDomain": p.uint32, "recipientAddress": p.bytes32, "messageBody": p.bytes, "metadata": p.bytes, "hook": p.address}, p.bytes32),
    'dispatch(uint32,bytes32,bytes,bytes)': fun("0x48aee8d4", "dispatch(uint32,bytes32,bytes,bytes)", {"destinationDomain": p.uint32, "recipientAddress": p.bytes32, "messageBody": p.bytes, "hookMetadata": p.bytes}, p.bytes32),
    'dispatch(uint32,bytes32,bytes)': fun("0xfa31de01", "dispatch(uint32,bytes32,bytes)", {"_destinationDomain": p.uint32, "_recipientAddress": p.bytes32, "_messageBody": p.bytes}, p.bytes32),
    initialize: fun("0xf8c8765e", "initialize(address,address,address,address)", {"_owner": p.address, "_defaultIsm": p.address, "_defaultHook": p.address, "_requiredHook": p.address}, ),
    latestDispatchedId: viewFun("0x134fbb4f", "latestDispatchedId()", {}, p.bytes32),
    localDomain: viewFun("0x8d3638f4", "localDomain()", {}, p.uint32),
    nonce: viewFun("0xaffed0e0", "nonce()", {}, p.uint32),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    process: fun("0x7c39d130", "process(bytes,bytes)", {"_metadata": p.bytes, "_message": p.bytes}, ),
    processedAt: viewFun("0x07a2fda1", "processedAt(bytes32)", {"_id": p.bytes32}, p.uint48),
    processor: viewFun("0x5d1fe5a9", "processor(bytes32)", {"_id": p.bytes32}, p.address),
    'quoteDispatch(uint32,bytes32,bytes,bytes,address)': viewFun("0x81d2ea95", "quoteDispatch(uint32,bytes32,bytes,bytes,address)", {"destinationDomain": p.uint32, "recipientAddress": p.bytes32, "messageBody": p.bytes, "metadata": p.bytes, "hook": p.address}, p.uint256),
    'quoteDispatch(uint32,bytes32,bytes)': viewFun("0x9c42bd18", "quoteDispatch(uint32,bytes32,bytes)", {"destinationDomain": p.uint32, "recipientAddress": p.bytes32, "messageBody": p.bytes}, p.uint256),
    'quoteDispatch(uint32,bytes32,bytes,bytes)': viewFun("0xf7ccd321", "quoteDispatch(uint32,bytes32,bytes,bytes)", {"destinationDomain": p.uint32, "recipientAddress": p.bytes32, "messageBody": p.bytes, "defaultHookMetadata": p.bytes}, p.uint256),
    recipientIsm: viewFun("0xe70f48ac", "recipientIsm(address)", {"_recipient": p.address}, p.address),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    requiredHook: viewFun("0xd6d08a09", "requiredHook()", {}, p.address),
    setDefaultHook: fun("0x99b04809", "setDefaultHook(address)", {"_hook": p.address}, ),
    setDefaultIsm: fun("0xf794687a", "setDefaultIsm(address)", {"_module": p.address}, ),
    setRequiredHook: fun("0x1426b7f4", "setRequiredHook(address)", {"_hook": p.address}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
}

export class Contract extends ContractBase {

    PACKAGE_VERSION() {
        return this.eth_call(functions.PACKAGE_VERSION, {})
    }

    VERSION() {
        return this.eth_call(functions.VERSION, {})
    }

    defaultHook() {
        return this.eth_call(functions.defaultHook, {})
    }

    defaultIsm() {
        return this.eth_call(functions.defaultIsm, {})
    }

    delivered(_id: DeliveredParams["_id"]) {
        return this.eth_call(functions.delivered, {_id})
    }

    deployedBlock() {
        return this.eth_call(functions.deployedBlock, {})
    }

    latestDispatchedId() {
        return this.eth_call(functions.latestDispatchedId, {})
    }

    localDomain() {
        return this.eth_call(functions.localDomain, {})
    }

    nonce() {
        return this.eth_call(functions.nonce, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    processedAt(_id: ProcessedAtParams["_id"]) {
        return this.eth_call(functions.processedAt, {_id})
    }

    processor(_id: ProcessorParams["_id"]) {
        return this.eth_call(functions.processor, {_id})
    }

    'quoteDispatch(uint32,bytes32,bytes,bytes,address)'(destinationDomain: QuoteDispatchParams_0["destinationDomain"], recipientAddress: QuoteDispatchParams_0["recipientAddress"], messageBody: QuoteDispatchParams_0["messageBody"], metadata: QuoteDispatchParams_0["metadata"], hook: QuoteDispatchParams_0["hook"]) {
        return this.eth_call(functions['quoteDispatch(uint32,bytes32,bytes,bytes,address)'], {destinationDomain, recipientAddress, messageBody, metadata, hook})
    }

    'quoteDispatch(uint32,bytes32,bytes)'(destinationDomain: QuoteDispatchParams_1["destinationDomain"], recipientAddress: QuoteDispatchParams_1["recipientAddress"], messageBody: QuoteDispatchParams_1["messageBody"]) {
        return this.eth_call(functions['quoteDispatch(uint32,bytes32,bytes)'], {destinationDomain, recipientAddress, messageBody})
    }

    'quoteDispatch(uint32,bytes32,bytes,bytes)'(destinationDomain: QuoteDispatchParams_2["destinationDomain"], recipientAddress: QuoteDispatchParams_2["recipientAddress"], messageBody: QuoteDispatchParams_2["messageBody"], defaultHookMetadata: QuoteDispatchParams_2["defaultHookMetadata"]) {
        return this.eth_call(functions['quoteDispatch(uint32,bytes32,bytes,bytes)'], {destinationDomain, recipientAddress, messageBody, defaultHookMetadata})
    }

    recipientIsm(_recipient: RecipientIsmParams["_recipient"]) {
        return this.eth_call(functions.recipientIsm, {_recipient})
    }

    requiredHook() {
        return this.eth_call(functions.requiredHook, {})
    }
}

/// Event types
export type DefaultHookSetEventArgs = EParams<typeof events.DefaultHookSet>
export type DefaultIsmSetEventArgs = EParams<typeof events.DefaultIsmSet>
export type DispatchEventArgs = EParams<typeof events.Dispatch>
export type DispatchIdEventArgs = EParams<typeof events.DispatchId>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type ProcessEventArgs = EParams<typeof events.Process>
export type ProcessIdEventArgs = EParams<typeof events.ProcessId>
export type RequiredHookSetEventArgs = EParams<typeof events.RequiredHookSet>

/// Function types
export type PACKAGE_VERSIONParams = FunctionArguments<typeof functions.PACKAGE_VERSION>
export type PACKAGE_VERSIONReturn = FunctionReturn<typeof functions.PACKAGE_VERSION>

export type VERSIONParams = FunctionArguments<typeof functions.VERSION>
export type VERSIONReturn = FunctionReturn<typeof functions.VERSION>

export type DefaultHookParams = FunctionArguments<typeof functions.defaultHook>
export type DefaultHookReturn = FunctionReturn<typeof functions.defaultHook>

export type DefaultIsmParams = FunctionArguments<typeof functions.defaultIsm>
export type DefaultIsmReturn = FunctionReturn<typeof functions.defaultIsm>

export type DeliveredParams = FunctionArguments<typeof functions.delivered>
export type DeliveredReturn = FunctionReturn<typeof functions.delivered>

export type DeployedBlockParams = FunctionArguments<typeof functions.deployedBlock>
export type DeployedBlockReturn = FunctionReturn<typeof functions.deployedBlock>

export type DispatchParams_0 = FunctionArguments<typeof functions['dispatch(uint32,bytes32,bytes,bytes,address)']>
export type DispatchReturn_0 = FunctionReturn<typeof functions['dispatch(uint32,bytes32,bytes,bytes,address)']>

export type DispatchParams_1 = FunctionArguments<typeof functions['dispatch(uint32,bytes32,bytes,bytes)']>
export type DispatchReturn_1 = FunctionReturn<typeof functions['dispatch(uint32,bytes32,bytes,bytes)']>

export type DispatchParams_2 = FunctionArguments<typeof functions['dispatch(uint32,bytes32,bytes)']>
export type DispatchReturn_2 = FunctionReturn<typeof functions['dispatch(uint32,bytes32,bytes)']>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type LatestDispatchedIdParams = FunctionArguments<typeof functions.latestDispatchedId>
export type LatestDispatchedIdReturn = FunctionReturn<typeof functions.latestDispatchedId>

export type LocalDomainParams = FunctionArguments<typeof functions.localDomain>
export type LocalDomainReturn = FunctionReturn<typeof functions.localDomain>

export type NonceParams = FunctionArguments<typeof functions.nonce>
export type NonceReturn = FunctionReturn<typeof functions.nonce>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type ProcessParams = FunctionArguments<typeof functions.process>
export type ProcessReturn = FunctionReturn<typeof functions.process>

export type ProcessedAtParams = FunctionArguments<typeof functions.processedAt>
export type ProcessedAtReturn = FunctionReturn<typeof functions.processedAt>

export type ProcessorParams = FunctionArguments<typeof functions.processor>
export type ProcessorReturn = FunctionReturn<typeof functions.processor>

export type QuoteDispatchParams_0 = FunctionArguments<typeof functions['quoteDispatch(uint32,bytes32,bytes,bytes,address)']>
export type QuoteDispatchReturn_0 = FunctionReturn<typeof functions['quoteDispatch(uint32,bytes32,bytes,bytes,address)']>

export type QuoteDispatchParams_1 = FunctionArguments<typeof functions['quoteDispatch(uint32,bytes32,bytes)']>
export type QuoteDispatchReturn_1 = FunctionReturn<typeof functions['quoteDispatch(uint32,bytes32,bytes)']>

export type QuoteDispatchParams_2 = FunctionArguments<typeof functions['quoteDispatch(uint32,bytes32,bytes,bytes)']>
export type QuoteDispatchReturn_2 = FunctionReturn<typeof functions['quoteDispatch(uint32,bytes32,bytes,bytes)']>

export type RecipientIsmParams = FunctionArguments<typeof functions.recipientIsm>
export type RecipientIsmReturn = FunctionReturn<typeof functions.recipientIsm>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type RequiredHookParams = FunctionArguments<typeof functions.requiredHook>
export type RequiredHookReturn = FunctionReturn<typeof functions.requiredHook>

export type SetDefaultHookParams = FunctionArguments<typeof functions.setDefaultHook>
export type SetDefaultHookReturn = FunctionReturn<typeof functions.setDefaultHook>

export type SetDefaultIsmParams = FunctionArguments<typeof functions.setDefaultIsm>
export type SetDefaultIsmReturn = FunctionReturn<typeof functions.setDefaultIsm>

export type SetRequiredHookParams = FunctionArguments<typeof functions.setRequiredHook>
export type SetRequiredHookReturn = FunctionReturn<typeof functions.setRequiredHook>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

