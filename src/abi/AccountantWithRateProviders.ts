import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AuthorityUpdated: event("0xa3396fd7f6e0a21b50e5089d2da70d5ac0a3bbbd1f617a93f134b76389980198", "AuthorityUpdated(address,address)", {"user": indexed(p.address), "newAuthority": indexed(p.address)}),
    Checkpoint: event("0xde5ae8a37da230f7df39b8ea385fa1ab48e7caa55f1c25eaaef1ed8690f36998", "Checkpoint(uint256)", {"timestamp": indexed(p.uint256)}),
    DelayInSecondsUpdated: event("0xcccad74cc0fcc3b3393386e7a89107fb131535e983a342329b52c667dafe9cf4", "DelayInSecondsUpdated(uint32,uint32)", {"oldDelay": p.uint32, "newDelay": p.uint32}),
    ExchangeRateUpdated: event("0xa95bc6aba40bbc4d95fc35f118c4cd8b53fc5d5b89ed264002af03503a7a9439", "ExchangeRateUpdated(uint96,uint96,uint64)", {"oldRate": p.uint96, "newRate": p.uint96, "currentTime": p.uint64}),
    FeesClaimed: event("0x9493e5bbe4e8e0ac67284469a2d677403d0378a85a59e341d3abc433d0d9a209", "FeesClaimed(address,uint256)", {"feeAsset": indexed(p.address), "amount": p.uint256}),
    LendingRateUpdated: event("0x0a9c318244244e39416463b44d234ce4b2bb5dd436ae1c642de3c781ae15c05d", "LendingRateUpdated(uint256,uint256)", {"newRate": p.uint256, "timestamp": p.uint256}),
    LowerBoundUpdated: event("0x76fe3c3557dd03afa5caf76f66f4019444ef3999e784ba08f47a33428fcc64d5", "LowerBoundUpdated(uint16,uint16)", {"oldBound": p.uint16, "newBound": p.uint16}),
    ManagementFeeRateUpdated: event("0x182033972d753025c854a36fd7c9cbb9da306ada9f706af5dd432c4321d628b5", "ManagementFeeRateUpdated(uint16,uint256)", {"newRate": p.uint16, "timestamp": p.uint256}),
    MaxLendingRateUpdated: event("0x3b877d2d41ebbc7a1525a9a02c0796e9d222cabf4f6e038c6bc478c31a8ec017", "MaxLendingRateUpdated(uint256)", {"newMaxRate": p.uint256}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"user": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x9e87fac88ff661f02d44f95383c817fece4bce600a3dab7a54406878b965e752", "Paused()", {}),
    PayoutAddressUpdated: event("0xba2be5e898fed1646bc0814dee1cc9a2aee98f51fced7d5fc4699c47d9907753", "PayoutAddressUpdated(address,address)", {"oldPayout": p.address, "newPayout": p.address}),
    RateProviderUpdated: event("0x59f9adfe8cf4c9d4b77fb03aa2ae5f373632c97cb8caf6b61f0643d3d170a8fe", "RateProviderUpdated(address,bool,address)", {"asset": p.address, "isPegged": p.bool, "rateProvider": p.address}),
    Unpaused: event("0xa45f47fdea8a1efdd9029a5691c7f759c32b7c698632b563573e155625d16933", "Unpaused()", {}),
    UpperBoundUpdated: event("0x67d3a3f6bebb5b894324217d5224ff719d5d95dfc67f1bb2645dddbfcd43cadb", "UpperBoundUpdated(uint16,uint16)", {"oldBound": p.uint16, "newBound": p.uint16}),
}

export const functions = {
    accountantState: viewFun("0x433255de", "accountantState()", {}, {"_payoutAddress": p.address, "_feesOwedInBase": p.uint128, "_totalSharesLastUpdate": p.uint128, "_exchangeRate": p.uint96, "_allowedExchangeRateChangeUpper": p.uint16, "_allowedExchangeRateChangeLower": p.uint16, "_lastUpdateTimestamp": p.uint64, "_isPaused": p.bool, "_minimumUpdateDelayInSeconds": p.uint32, "_managementFee": p.uint16}),
    authority: viewFun("0xbf7e214f", "authority()", {}, p.address),
    base: viewFun("0x5001f3b5", "base()", {}, p.address),
    calculateExchangeRateWithInterest: viewFun("0x7ea9de18", "calculateExchangeRateWithInterest()", {}, {"newRate": p.uint96, "interestAccrued": p.uint256}),
    checkpoint: fun("0xc2c4c5c1", "checkpoint()", {}, ),
    claimFees: fun("0x15a0ea6a", "claimFees(address)", {"_feeAsset": p.address}, ),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    getBorrowerRate: viewFun("0x09a3a07c", "getBorrowerRate()", {}, p.uint256),
    getRate: viewFun("0x679aefce", "getRate()", {}, p.uint256),
    getRateInQuote: viewFun("0x1dcbb110", "getRateInQuote(address)", {"_quote": p.address}, p.uint256),
    getRateInQuoteSafe: viewFun("0x820973da", "getRateInQuoteSafe(address)", {"_quote": p.address}, p.uint256),
    getRateSafe: viewFun("0x282a8700", "getRateSafe()", {}, p.uint256),
    lendingInfo: viewFun("0x44684e03", "lendingInfo()", {}, {"_lendingRate": p.uint256, "_lastAccrualTime": p.uint256}),
    maxLendingRate: viewFun("0x874495d8", "maxLendingRate()", {}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    previewFeesOwed: viewFun("0x5a135abe", "previewFeesOwed()", {}, p.uint256),
    rateProviderData: viewFun("0x12e2d8f3", "rateProviderData(address)", {"_0": p.address}, {"isPeggedToBase": p.bool, "rateProvider": p.address}),
    setAuthority: fun("0x7a9e5e4b", "setAuthority(address)", {"newAuthority": p.address}, ),
    setLendingRate: fun("0x939c2a2b", "setLendingRate(uint256)", {"_lendingRate": p.uint256}, ),
    setManagementFeeRate: fun("0x6eda9afa", "setManagementFeeRate(uint16)", {"_managementFeeRate": p.uint16}, ),
    setMaxLendingRate: fun("0x91f30e3c", "setMaxLendingRate(uint256)", {"_maxLendingRate": p.uint256}, ),
    setRateProviderData: fun("0x4d8be07e", "setRateProviderData(address,bool,address)", {"_asset": p.address, "_isPeggedToBase": p.bool, "_rateProvider": p.address}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    updateDelay: fun("0xbdca5fbd", "updateDelay(uint32)", {"_minimumUpdateDelayInSeconds": p.uint32}, ),
    updateExchangeRate: fun("0x3458113d", "updateExchangeRate(uint96)", {"_newExchangeRate": p.uint96}, ),
    updateLower: fun("0x207ec0e7", "updateLower(uint16)", {"_allowedExchangeRateChangeLower": p.uint16}, ),
    updatePayoutAddress: fun("0x56200819", "updatePayoutAddress(address)", {"_payoutAddress": p.address}, ),
    updateUpper: fun("0x634da58f", "updateUpper(uint16)", {"_allowedExchangeRateChangeUpper": p.uint16}, ),
    vault: viewFun("0xfbfa77cf", "vault()", {}, p.address),
}

export class Contract extends ContractBase {

    accountantState() {
        return this.eth_call(functions.accountantState, {})
    }

    authority() {
        return this.eth_call(functions.authority, {})
    }

    base() {
        return this.eth_call(functions.base, {})
    }

    calculateExchangeRateWithInterest() {
        return this.eth_call(functions.calculateExchangeRateWithInterest, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    getBorrowerRate() {
        return this.eth_call(functions.getBorrowerRate, {})
    }

    getRate() {
        return this.eth_call(functions.getRate, {})
    }

    getRateInQuote(_quote: GetRateInQuoteParams["_quote"]) {
        return this.eth_call(functions.getRateInQuote, {_quote})
    }

    getRateInQuoteSafe(_quote: GetRateInQuoteSafeParams["_quote"]) {
        return this.eth_call(functions.getRateInQuoteSafe, {_quote})
    }

    getRateSafe() {
        return this.eth_call(functions.getRateSafe, {})
    }

    lendingInfo() {
        return this.eth_call(functions.lendingInfo, {})
    }

    maxLendingRate() {
        return this.eth_call(functions.maxLendingRate, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    previewFeesOwed() {
        return this.eth_call(functions.previewFeesOwed, {})
    }

    rateProviderData(_0: RateProviderDataParams["_0"]) {
        return this.eth_call(functions.rateProviderData, {_0})
    }

    vault() {
        return this.eth_call(functions.vault, {})
    }
}

/// Event types
export type AuthorityUpdatedEventArgs = EParams<typeof events.AuthorityUpdated>
export type CheckpointEventArgs = EParams<typeof events.Checkpoint>
export type DelayInSecondsUpdatedEventArgs = EParams<typeof events.DelayInSecondsUpdated>
export type ExchangeRateUpdatedEventArgs = EParams<typeof events.ExchangeRateUpdated>
export type FeesClaimedEventArgs = EParams<typeof events.FeesClaimed>
export type LendingRateUpdatedEventArgs = EParams<typeof events.LendingRateUpdated>
export type LowerBoundUpdatedEventArgs = EParams<typeof events.LowerBoundUpdated>
export type ManagementFeeRateUpdatedEventArgs = EParams<typeof events.ManagementFeeRateUpdated>
export type MaxLendingRateUpdatedEventArgs = EParams<typeof events.MaxLendingRateUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type PayoutAddressUpdatedEventArgs = EParams<typeof events.PayoutAddressUpdated>
export type RateProviderUpdatedEventArgs = EParams<typeof events.RateProviderUpdated>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type UpperBoundUpdatedEventArgs = EParams<typeof events.UpperBoundUpdated>

/// Function types
export type AccountantStateParams = FunctionArguments<typeof functions.accountantState>
export type AccountantStateReturn = FunctionReturn<typeof functions.accountantState>

export type AuthorityParams = FunctionArguments<typeof functions.authority>
export type AuthorityReturn = FunctionReturn<typeof functions.authority>

export type BaseParams = FunctionArguments<typeof functions.base>
export type BaseReturn = FunctionReturn<typeof functions.base>

export type CalculateExchangeRateWithInterestParams = FunctionArguments<typeof functions.calculateExchangeRateWithInterest>
export type CalculateExchangeRateWithInterestReturn = FunctionReturn<typeof functions.calculateExchangeRateWithInterest>

export type CheckpointParams = FunctionArguments<typeof functions.checkpoint>
export type CheckpointReturn = FunctionReturn<typeof functions.checkpoint>

export type ClaimFeesParams = FunctionArguments<typeof functions.claimFees>
export type ClaimFeesReturn = FunctionReturn<typeof functions.claimFees>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type GetBorrowerRateParams = FunctionArguments<typeof functions.getBorrowerRate>
export type GetBorrowerRateReturn = FunctionReturn<typeof functions.getBorrowerRate>

export type GetRateParams = FunctionArguments<typeof functions.getRate>
export type GetRateReturn = FunctionReturn<typeof functions.getRate>

export type GetRateInQuoteParams = FunctionArguments<typeof functions.getRateInQuote>
export type GetRateInQuoteReturn = FunctionReturn<typeof functions.getRateInQuote>

export type GetRateInQuoteSafeParams = FunctionArguments<typeof functions.getRateInQuoteSafe>
export type GetRateInQuoteSafeReturn = FunctionReturn<typeof functions.getRateInQuoteSafe>

export type GetRateSafeParams = FunctionArguments<typeof functions.getRateSafe>
export type GetRateSafeReturn = FunctionReturn<typeof functions.getRateSafe>

export type LendingInfoParams = FunctionArguments<typeof functions.lendingInfo>
export type LendingInfoReturn = FunctionReturn<typeof functions.lendingInfo>

export type MaxLendingRateParams = FunctionArguments<typeof functions.maxLendingRate>
export type MaxLendingRateReturn = FunctionReturn<typeof functions.maxLendingRate>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PreviewFeesOwedParams = FunctionArguments<typeof functions.previewFeesOwed>
export type PreviewFeesOwedReturn = FunctionReturn<typeof functions.previewFeesOwed>

export type RateProviderDataParams = FunctionArguments<typeof functions.rateProviderData>
export type RateProviderDataReturn = FunctionReturn<typeof functions.rateProviderData>

export type SetAuthorityParams = FunctionArguments<typeof functions.setAuthority>
export type SetAuthorityReturn = FunctionReturn<typeof functions.setAuthority>

export type SetLendingRateParams = FunctionArguments<typeof functions.setLendingRate>
export type SetLendingRateReturn = FunctionReturn<typeof functions.setLendingRate>

export type SetManagementFeeRateParams = FunctionArguments<typeof functions.setManagementFeeRate>
export type SetManagementFeeRateReturn = FunctionReturn<typeof functions.setManagementFeeRate>

export type SetMaxLendingRateParams = FunctionArguments<typeof functions.setMaxLendingRate>
export type SetMaxLendingRateReturn = FunctionReturn<typeof functions.setMaxLendingRate>

export type SetRateProviderDataParams = FunctionArguments<typeof functions.setRateProviderData>
export type SetRateProviderDataReturn = FunctionReturn<typeof functions.setRateProviderData>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UpdateDelayParams = FunctionArguments<typeof functions.updateDelay>
export type UpdateDelayReturn = FunctionReturn<typeof functions.updateDelay>

export type UpdateExchangeRateParams = FunctionArguments<typeof functions.updateExchangeRate>
export type UpdateExchangeRateReturn = FunctionReturn<typeof functions.updateExchangeRate>

export type UpdateLowerParams = FunctionArguments<typeof functions.updateLower>
export type UpdateLowerReturn = FunctionReturn<typeof functions.updateLower>

export type UpdatePayoutAddressParams = FunctionArguments<typeof functions.updatePayoutAddress>
export type UpdatePayoutAddressReturn = FunctionReturn<typeof functions.updatePayoutAddress>

export type UpdateUpperParams = FunctionArguments<typeof functions.updateUpper>
export type UpdateUpperReturn = FunctionReturn<typeof functions.updateUpper>

export type VaultParams = FunctionArguments<typeof functions.vault>
export type VaultReturn = FunctionReturn<typeof functions.vault>

