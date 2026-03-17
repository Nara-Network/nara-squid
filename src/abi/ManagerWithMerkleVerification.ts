import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AuthorityUpdated: event("0xa3396fd7f6e0a21b50e5089d2da70d5ac0a3bbbd1f617a93f134b76389980198", "AuthorityUpdated(address,address)", {"user": indexed(p.address), "newAuthority": indexed(p.address)}),
    BoringVaultManaged: event("0x53d426e7d80bb2c8674d3b45577e2d464d423faad6531b21f95ac11ac18b1cb6", "BoringVaultManaged(uint256)", {"callsMade": p.uint256}),
    ManageRootUpdated: event("0x0b958dec85f1470000479dfb22c365829411f52bcde602d24ea0abf5ac7e8860", "ManageRootUpdated(address,bytes32,bytes32)", {"strategist": indexed(p.address), "oldRoot": p.bytes32, "newRoot": p.bytes32}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"user": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x9e87fac88ff661f02d44f95383c817fece4bce600a3dab7a54406878b965e752", "Paused()", {}),
    Unpaused: event("0xa45f47fdea8a1efdd9029a5691c7f759c32b7c698632b563573e155625d16933", "Unpaused()", {}),
}

export const functions = {
    authority: viewFun("0xbf7e214f", "authority()", {}, p.address),
    balancerVault: viewFun("0x158274a5", "balancerVault()", {}, p.address),
    flashLoan: fun("0x5c38449e", "flashLoan(address,address[],uint256[],bytes)", {"recipient": p.address, "tokens": p.array(p.address), "amounts": p.array(p.uint256), "userData": p.bytes}, ),
    isPaused: viewFun("0xb187bd26", "isPaused()", {}, p.bool),
    manageRoot: viewFun("0x5ca58a99", "manageRoot(address)", {"_0": p.address}, p.bytes32),
    manageVaultWithMerkleVerification: fun("0x244b0f6a", "manageVaultWithMerkleVerification(bytes32[][],address[],address[],bytes[],uint256[])", {"manageProofs": p.array(p.array(p.bytes32)), "decodersAndSanitizers": p.array(p.address), "targets": p.array(p.address), "targetData": p.array(p.bytes), "values": p.array(p.uint256)}, ),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    receiveFlashLoan: fun("0xf04f2707", "receiveFlashLoan(address[],uint256[],uint256[],bytes)", {"tokens": p.array(p.address), "amounts": p.array(p.uint256), "feeAmounts": p.array(p.uint256), "userData": p.bytes}, ),
    setAuthority: fun("0x7a9e5e4b", "setAuthority(address)", {"newAuthority": p.address}, ),
    setManageRoot: fun("0x21801a99", "setManageRoot(address,bytes32)", {"strategist": p.address, "_manageRoot": p.bytes32}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    vault: viewFun("0xfbfa77cf", "vault()", {}, p.address),
}

export class Contract extends ContractBase {

    authority() {
        return this.eth_call(functions.authority, {})
    }

    balancerVault() {
        return this.eth_call(functions.balancerVault, {})
    }

    isPaused() {
        return this.eth_call(functions.isPaused, {})
    }

    manageRoot(_0: ManageRootParams["_0"]) {
        return this.eth_call(functions.manageRoot, {_0})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    vault() {
        return this.eth_call(functions.vault, {})
    }
}

/// Event types
export type AuthorityUpdatedEventArgs = EParams<typeof events.AuthorityUpdated>
export type BoringVaultManagedEventArgs = EParams<typeof events.BoringVaultManaged>
export type ManageRootUpdatedEventArgs = EParams<typeof events.ManageRootUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type AuthorityParams = FunctionArguments<typeof functions.authority>
export type AuthorityReturn = FunctionReturn<typeof functions.authority>

export type BalancerVaultParams = FunctionArguments<typeof functions.balancerVault>
export type BalancerVaultReturn = FunctionReturn<typeof functions.balancerVault>

export type FlashLoanParams = FunctionArguments<typeof functions.flashLoan>
export type FlashLoanReturn = FunctionReturn<typeof functions.flashLoan>

export type IsPausedParams = FunctionArguments<typeof functions.isPaused>
export type IsPausedReturn = FunctionReturn<typeof functions.isPaused>

export type ManageRootParams = FunctionArguments<typeof functions.manageRoot>
export type ManageRootReturn = FunctionReturn<typeof functions.manageRoot>

export type ManageVaultWithMerkleVerificationParams = FunctionArguments<typeof functions.manageVaultWithMerkleVerification>
export type ManageVaultWithMerkleVerificationReturn = FunctionReturn<typeof functions.manageVaultWithMerkleVerification>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type ReceiveFlashLoanParams = FunctionArguments<typeof functions.receiveFlashLoan>
export type ReceiveFlashLoanReturn = FunctionReturn<typeof functions.receiveFlashLoan>

export type SetAuthorityParams = FunctionArguments<typeof functions.setAuthority>
export type SetAuthorityReturn = FunctionReturn<typeof functions.setAuthority>

export type SetManageRootParams = FunctionArguments<typeof functions.setManageRoot>
export type SetManageRootReturn = FunctionReturn<typeof functions.setManageRoot>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type VaultParams = FunctionArguments<typeof functions.vault>
export type VaultReturn = FunctionReturn<typeof functions.vault>

