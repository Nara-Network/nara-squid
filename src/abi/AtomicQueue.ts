import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AtomicRequestFulfilled: event("0xa4e3f90ef19273220b37cbbbcfe402a6eadd9559c54813b9be52ea0c9612d6c9", "AtomicRequestFulfilled(address,address,address,uint256,uint256,uint256)", {"user": p.address, "offerToken": p.address, "wantToken": p.address, "offerAmountSpent": p.uint256, "wantAmountReceived": p.uint256, "timestamp": p.uint256}),
    AtomicRequestUpdated: event("0x9537495a2390e1a29f5f7e71b8540f5140bba27065f173615b770ad79d2f7960", "AtomicRequestUpdated(address,address,address,uint256,uint256,uint256,uint256)", {"user": p.address, "offerToken": p.address, "wantToken": p.address, "amount": p.uint256, "deadline": p.uint256, "minPrice": p.uint256, "timestamp": p.uint256}),
    AuthorityUpdated: event("0xa3396fd7f6e0a21b50e5089d2da70d5ac0a3bbbd1f617a93f134b76389980198", "AuthorityUpdated(address,address)", {"user": indexed(p.address), "newAuthority": indexed(p.address)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"user": indexed(p.address), "newOwner": indexed(p.address)}),
}

export const functions = {
    accountant: viewFun("0x4fb3ccc5", "accountant()", {}, p.address),
    authority: viewFun("0xbf7e214f", "authority()", {}, p.address),
    getUserAtomicRequest: viewFun("0x433a8534", "getUserAtomicRequest(address,address,address)", {"user": p.address, "offer": p.address, "want": p.address}, p.struct({"deadline": p.uint64, "offerAmount": p.uint96, "inSolve": p.bool})),
    isAtomicRequestValid: viewFun("0x6a217633", "isAtomicRequestValid(address,address,(uint64,uint96,bool))", {"offer": p.address, "user": p.address, "userRequest": p.struct({"deadline": p.uint64, "offerAmount": p.uint96, "inSolve": p.bool})}, p.bool),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    setAuthority: fun("0x7a9e5e4b", "setAuthority(address)", {"newAuthority": p.address}, ),
    solve: fun("0xd93fc203", "solve(address,address,address[],bytes,address)", {"offer": p.address, "want": p.address, "users": p.array(p.address), "runData": p.bytes, "solver": p.address}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updateAtomicRequest: fun("0xc3b52346", "updateAtomicRequest(address,address,uint64,uint96)", {"offer": p.address, "want": p.address, "deadline": p.uint64, "offerAmount": p.uint96}, ),
    userAtomicRequest: viewFun("0x7abf631d", "userAtomicRequest(address,address,address)", {"_0": p.address, "_1": p.address, "_2": p.address}, {"deadline": p.uint64, "offerAmount": p.uint96, "inSolve": p.bool}),
    viewSolveMetaData: viewFun("0x2ae2f071", "viewSolveMetaData(address,address,address[])", {"offer": p.address, "want": p.address, "users": p.array(p.address)}, {"metaData": p.array(p.struct({"user": p.address, "flags": p.uint8, "assetsToOffer": p.uint256, "assetsForWant": p.uint256})), "totalAssetsForWant": p.uint256, "totalAssetsToOffer": p.uint256}),
}

export class Contract extends ContractBase {

    accountant() {
        return this.eth_call(functions.accountant, {})
    }

    authority() {
        return this.eth_call(functions.authority, {})
    }

    getUserAtomicRequest(user: GetUserAtomicRequestParams["user"], offer: GetUserAtomicRequestParams["offer"], want: GetUserAtomicRequestParams["want"]) {
        return this.eth_call(functions.getUserAtomicRequest, {user, offer, want})
    }

    isAtomicRequestValid(offer: IsAtomicRequestValidParams["offer"], user: IsAtomicRequestValidParams["user"], userRequest: IsAtomicRequestValidParams["userRequest"]) {
        return this.eth_call(functions.isAtomicRequestValid, {offer, user, userRequest})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    userAtomicRequest(_0: UserAtomicRequestParams["_0"], _1: UserAtomicRequestParams["_1"], _2: UserAtomicRequestParams["_2"]) {
        return this.eth_call(functions.userAtomicRequest, {_0, _1, _2})
    }

    viewSolveMetaData(offer: ViewSolveMetaDataParams["offer"], want: ViewSolveMetaDataParams["want"], users: ViewSolveMetaDataParams["users"]) {
        return this.eth_call(functions.viewSolveMetaData, {offer, want, users})
    }
}

/// Event types
export type AtomicRequestFulfilledEventArgs = EParams<typeof events.AtomicRequestFulfilled>
export type AtomicRequestUpdatedEventArgs = EParams<typeof events.AtomicRequestUpdated>
export type AuthorityUpdatedEventArgs = EParams<typeof events.AuthorityUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>

/// Function types
export type AccountantParams = FunctionArguments<typeof functions.accountant>
export type AccountantReturn = FunctionReturn<typeof functions.accountant>

export type AuthorityParams = FunctionArguments<typeof functions.authority>
export type AuthorityReturn = FunctionReturn<typeof functions.authority>

export type GetUserAtomicRequestParams = FunctionArguments<typeof functions.getUserAtomicRequest>
export type GetUserAtomicRequestReturn = FunctionReturn<typeof functions.getUserAtomicRequest>

export type IsAtomicRequestValidParams = FunctionArguments<typeof functions.isAtomicRequestValid>
export type IsAtomicRequestValidReturn = FunctionReturn<typeof functions.isAtomicRequestValid>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type SetAuthorityParams = FunctionArguments<typeof functions.setAuthority>
export type SetAuthorityReturn = FunctionReturn<typeof functions.setAuthority>

export type SolveParams = FunctionArguments<typeof functions.solve>
export type SolveReturn = FunctionReturn<typeof functions.solve>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdateAtomicRequestParams = FunctionArguments<typeof functions.updateAtomicRequest>
export type UpdateAtomicRequestReturn = FunctionReturn<typeof functions.updateAtomicRequest>

export type UserAtomicRequestParams = FunctionArguments<typeof functions.userAtomicRequest>
export type UserAtomicRequestReturn = FunctionReturn<typeof functions.userAtomicRequest>

export type ViewSolveMetaDataParams = FunctionArguments<typeof functions.viewSolveMetaData>
export type ViewSolveMetaDataReturn = FunctionReturn<typeof functions.viewSolveMetaData>

