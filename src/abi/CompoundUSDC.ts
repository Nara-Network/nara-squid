import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AbsorbCollateral: event("0x9850ab1af75177e4a9201c65a2cf7976d5d28e40ef63494b44366f86b2f9412e", "AbsorbCollateral(address,address,address,uint256,uint256)", {"absorber": indexed(p.address), "borrower": indexed(p.address), "asset": indexed(p.address), "collateralAbsorbed": p.uint256, "usdValue": p.uint256}),
    AbsorbDebt: event("0x1547a878dc89ad3c367b6338b4be6a65a5dd74fb77ae044da1e8747ef1f4f62f", "AbsorbDebt(address,address,uint256,uint256)", {"absorber": indexed(p.address), "borrower": indexed(p.address), "basePaidOut": p.uint256, "usdValue": p.uint256}),
    BuyCollateral: event("0xf891b2a411b0e66a5f0a6ff1368670fefa287a13f541eb633a386a1a9cc7046b", "BuyCollateral(address,address,uint256,uint256)", {"buyer": indexed(p.address), "asset": indexed(p.address), "baseAmount": p.uint256, "collateralAmount": p.uint256}),
    PauseAction: event("0x3be39979091ae7ca962aa1c44e645f2df3c221b79f324afa5f44aedc8d2f690d", "PauseAction(bool,bool,bool,bool,bool)", {"supplyPaused": p.bool, "transferPaused": p.bool, "withdrawPaused": p.bool, "absorbPaused": p.bool, "buyPaused": p.bool}),
    Supply: event("0xd1cf3d156d5f8f0d50f6c122ed609cec09d35c9b9fb3fff6ea0959134dae424e", "Supply(address,address,uint256)", {"from": indexed(p.address), "dst": indexed(p.address), "amount": p.uint256}),
    SupplyCollateral: event("0xfa56f7b24f17183d81894d3ac2ee654e3c26388d17a28dbd9549b8114304e1f4", "SupplyCollateral(address,address,address,uint256)", {"from": indexed(p.address), "dst": indexed(p.address), "asset": indexed(p.address), "amount": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
    TransferCollateral: event("0x29db89d45e1a802b4d55e202984fce9faf1d30aedf86503ff1ea0ed9ebb64201", "TransferCollateral(address,address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "asset": indexed(p.address), "amount": p.uint256}),
    Withdraw: event("0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb", "Withdraw(address,address,uint256)", {"src": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
    WithdrawCollateral: event("0xd6d480d5b3068db003533b170d67561494d72e3bf9fa40a266471351ebba9e16", "WithdrawCollateral(address,address,address,uint256)", {"src": indexed(p.address), "to": indexed(p.address), "asset": indexed(p.address), "amount": p.uint256}),
    WithdrawReserves: event("0xec4431f2ba1a9382f6b0c4352b888cba6f7db91667d9f776abe5ad8ddc5401b6", "WithdrawReserves(address,uint256)", {"to": indexed(p.address), "amount": p.uint256}),
}

export const functions = {
    absorb: fun("0xc3cecfd2", "absorb(address,address[])", {"absorber": p.address, "accounts": p.array(p.address)}, ),
    accrueAccount: fun("0xbfe69c8d", "accrueAccount(address)", {"account": p.address}, ),
    approveThis: fun("0xad14777c", "approveThis(address,address,uint256)", {"manager": p.address, "asset": p.address, "amount": p.uint256}, ),
    assetList: viewFun("0xe372f03a", "assetList()", {}, p.address),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    baseBorrowMin: viewFun("0x300e6beb", "baseBorrowMin()", {}, p.uint256),
    baseMinForRewards: viewFun("0x9364e18a", "baseMinForRewards()", {}, p.uint256),
    baseScale: viewFun("0x44c1e5eb", "baseScale()", {}, p.uint256),
    baseToken: viewFun("0xc55dae63", "baseToken()", {}, p.address),
    baseTokenPriceFeed: viewFun("0xe7dad6bd", "baseTokenPriceFeed()", {}, p.address),
    baseTrackingBorrowSpeed: viewFun("0x9ea99a5a", "baseTrackingBorrowSpeed()", {}, p.uint256),
    baseTrackingSupplySpeed: viewFun("0x189bb2f1", "baseTrackingSupplySpeed()", {}, p.uint256),
    borrowBalanceOf: viewFun("0x374c49b4", "borrowBalanceOf(address)", {"account": p.address}, p.uint256),
    borrowKink: viewFun("0x9241a561", "borrowKink()", {}, p.uint256),
    borrowPerSecondInterestRateBase: viewFun("0x7914acc7", "borrowPerSecondInterestRateBase()", {}, p.uint256),
    borrowPerSecondInterestRateSlopeHigh: viewFun("0x2a48cf12", "borrowPerSecondInterestRateSlopeHigh()", {}, p.uint256),
    borrowPerSecondInterestRateSlopeLow: viewFun("0x2d05670b", "borrowPerSecondInterestRateSlopeLow()", {}, p.uint256),
    buyCollateral: fun("0xe4e6e779", "buyCollateral(address,uint256,uint256,address)", {"asset": p.address, "minAmount": p.uint256, "baseAmount": p.uint256, "recipient": p.address}, ),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    extensionDelegate: viewFun("0x44ff241d", "extensionDelegate()", {}, p.address),
    getAssetInfo: viewFun("0xc8c7fe6b", "getAssetInfo(uint8)", {"i": p.uint8}, p.struct({"offset": p.uint8, "asset": p.address, "priceFeed": p.address, "scale": p.uint64, "borrowCollateralFactor": p.uint64, "liquidateCollateralFactor": p.uint64, "liquidationFactor": p.uint64, "supplyCap": p.uint128})),
    getAssetInfoByAddress: viewFun("0x3b3bec2e", "getAssetInfoByAddress(address)", {"asset": p.address}, p.struct({"offset": p.uint8, "asset": p.address, "priceFeed": p.address, "scale": p.uint64, "borrowCollateralFactor": p.uint64, "liquidateCollateralFactor": p.uint64, "liquidationFactor": p.uint64, "supplyCap": p.uint128})),
    getBorrowRate: viewFun("0x9fa83b5a", "getBorrowRate(uint256)", {"utilization": p.uint256}, p.uint64),
    getCollateralReserves: viewFun("0x9ff567f8", "getCollateralReserves(address)", {"asset": p.address}, p.uint256),
    getPrice: viewFun("0x41976e09", "getPrice(address)", {"priceFeed": p.address}, p.uint256),
    getReserves: viewFun("0x0902f1ac", "getReserves()", {}, p.int256),
    getSupplyRate: viewFun("0xd955759d", "getSupplyRate(uint256)", {"utilization": p.uint256}, p.uint64),
    getUtilization: viewFun("0x7eb71131", "getUtilization()", {}, p.uint256),
    governor: viewFun("0x0c340a24", "governor()", {}, p.address),
    hasPermission: viewFun("0xcde68041", "hasPermission(address,address)", {"owner": p.address, "manager": p.address}, p.bool),
    initializeStorage: fun("0x1c9f7fb9", "initializeStorage()", {}, ),
    isAbsorbPaused: viewFun("0x8d5d814c", "isAbsorbPaused()", {}, p.bool),
    isAllowed: viewFun("0xa1654379", "isAllowed(address,address)", {"_0": p.address, "_1": p.address}, p.bool),
    isBorrowCollateralized: viewFun("0x38aa813f", "isBorrowCollateralized(address)", {"account": p.address}, p.bool),
    isBuyPaused: viewFun("0xd8e5f611", "isBuyPaused()", {}, p.bool),
    isLiquidatable: viewFun("0x042e02cf", "isLiquidatable(address)", {"account": p.address}, p.bool),
    isSupplyPaused: viewFun("0x0bc47ad1", "isSupplyPaused()", {}, p.bool),
    isTransferPaused: viewFun("0xa1a1ef43", "isTransferPaused()", {}, p.bool),
    isWithdrawPaused: viewFun("0x67800b5f", "isWithdrawPaused()", {}, p.bool),
    liquidatorPoints: viewFun("0xc5fa15cf", "liquidatorPoints(address)", {"_0": p.address}, {"numAbsorbs": p.uint32, "numAbsorbed": p.uint64, "approxSpend": p.uint128, "_reserved": p.uint32}),
    numAssets: viewFun("0xa46fe83b", "numAssets()", {}, p.uint8),
    pause: fun("0x44c35d07", "pause(bool,bool,bool,bool,bool)", {"supplyPaused": p.bool, "transferPaused": p.bool, "withdrawPaused": p.bool, "absorbPaused": p.bool, "buyPaused": p.bool}, ),
    pauseGuardian: viewFun("0x24a3d622", "pauseGuardian()", {}, p.address),
    quoteCollateral: viewFun("0x7ac88ed1", "quoteCollateral(address,uint256)", {"asset": p.address, "baseAmount": p.uint256}, p.uint256),
    storeFrontPriceFactor: viewFun("0x1f5954bd", "storeFrontPriceFactor()", {}, p.uint256),
    supply: fun("0xf2b9fdb8", "supply(address,uint256)", {"asset": p.address, "amount": p.uint256}, ),
    supplyFrom: fun("0x90323177", "supplyFrom(address,address,address,uint256)", {"from": p.address, "dst": p.address, "asset": p.address, "amount": p.uint256}, ),
    supplyKink: viewFun("0xa5b4ff79", "supplyKink()", {}, p.uint256),
    supplyPerSecondInterestRateBase: viewFun("0x94920cca", "supplyPerSecondInterestRateBase()", {}, p.uint256),
    supplyPerSecondInterestRateSlopeHigh: viewFun("0x804de71f", "supplyPerSecondInterestRateSlopeHigh()", {}, p.uint256),
    supplyPerSecondInterestRateSlopeLow: viewFun("0x5a94b8d1", "supplyPerSecondInterestRateSlopeLow()", {}, p.uint256),
    supplyTo: fun("0x4232cd63", "supplyTo(address,address,uint256)", {"dst": p.address, "asset": p.address, "amount": p.uint256}, ),
    targetReserves: viewFun("0x32176c49", "targetReserves()", {}, p.uint256),
    totalBorrow: viewFun("0x8285ef40", "totalBorrow()", {}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    totalsCollateral: viewFun("0x59e017bd", "totalsCollateral(address)", {"_0": p.address}, {"totalSupplyAsset": p.uint128, "_reserved": p.uint128}),
    trackingIndexScale: viewFun("0xaba7f15e", "trackingIndexScale()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"dst": p.address, "amount": p.uint256}, p.bool),
    transferAsset: fun("0x439e2e45", "transferAsset(address,address,uint256)", {"dst": p.address, "asset": p.address, "amount": p.uint256}, ),
    transferAssetFrom: fun("0xc1ee2c18", "transferAssetFrom(address,address,address,uint256)", {"src": p.address, "dst": p.address, "asset": p.address, "amount": p.uint256}, ),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"src": p.address, "dst": p.address, "amount": p.uint256}, p.bool),
    userBasic: viewFun("0xdc4abafd", "userBasic(address)", {"_0": p.address}, {"principal": p.int104, "baseTrackingIndex": p.uint64, "baseTrackingAccrued": p.uint64, "assetsIn": p.uint16, "_reserved": p.uint8}),
    userCollateral: viewFun("0x2b92a07d", "userCollateral(address,address)", {"_0": p.address, "_1": p.address}, {"balance": p.uint128, "_reserved": p.uint128}),
    userNonce: viewFun("0x2e04b8e7", "userNonce(address)", {"_0": p.address}, p.uint256),
    withdraw: fun("0xf3fef3a3", "withdraw(address,uint256)", {"asset": p.address, "amount": p.uint256}, ),
    withdrawFrom: fun("0x26441318", "withdrawFrom(address,address,address,uint256)", {"src": p.address, "to": p.address, "asset": p.address, "amount": p.uint256}, ),
    withdrawReserves: fun("0xe478795d", "withdrawReserves(address,uint256)", {"to": p.address, "amount": p.uint256}, ),
    withdrawTo: fun("0xc3b35a7e", "withdrawTo(address,address,uint256)", {"to": p.address, "asset": p.address, "amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    assetList() {
        return this.eth_call(functions.assetList, {})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    baseBorrowMin() {
        return this.eth_call(functions.baseBorrowMin, {})
    }

    baseMinForRewards() {
        return this.eth_call(functions.baseMinForRewards, {})
    }

    baseScale() {
        return this.eth_call(functions.baseScale, {})
    }

    baseToken() {
        return this.eth_call(functions.baseToken, {})
    }

    baseTokenPriceFeed() {
        return this.eth_call(functions.baseTokenPriceFeed, {})
    }

    baseTrackingBorrowSpeed() {
        return this.eth_call(functions.baseTrackingBorrowSpeed, {})
    }

    baseTrackingSupplySpeed() {
        return this.eth_call(functions.baseTrackingSupplySpeed, {})
    }

    borrowBalanceOf(account: BorrowBalanceOfParams["account"]) {
        return this.eth_call(functions.borrowBalanceOf, {account})
    }

    borrowKink() {
        return this.eth_call(functions.borrowKink, {})
    }

    borrowPerSecondInterestRateBase() {
        return this.eth_call(functions.borrowPerSecondInterestRateBase, {})
    }

    borrowPerSecondInterestRateSlopeHigh() {
        return this.eth_call(functions.borrowPerSecondInterestRateSlopeHigh, {})
    }

    borrowPerSecondInterestRateSlopeLow() {
        return this.eth_call(functions.borrowPerSecondInterestRateSlopeLow, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    extensionDelegate() {
        return this.eth_call(functions.extensionDelegate, {})
    }

    getAssetInfo(i: GetAssetInfoParams["i"]) {
        return this.eth_call(functions.getAssetInfo, {i})
    }

    getAssetInfoByAddress(asset: GetAssetInfoByAddressParams["asset"]) {
        return this.eth_call(functions.getAssetInfoByAddress, {asset})
    }

    getBorrowRate(utilization: GetBorrowRateParams["utilization"]) {
        return this.eth_call(functions.getBorrowRate, {utilization})
    }

    getCollateralReserves(asset: GetCollateralReservesParams["asset"]) {
        return this.eth_call(functions.getCollateralReserves, {asset})
    }

    getPrice(priceFeed: GetPriceParams["priceFeed"]) {
        return this.eth_call(functions.getPrice, {priceFeed})
    }

    getReserves() {
        return this.eth_call(functions.getReserves, {})
    }

    getSupplyRate(utilization: GetSupplyRateParams["utilization"]) {
        return this.eth_call(functions.getSupplyRate, {utilization})
    }

    getUtilization() {
        return this.eth_call(functions.getUtilization, {})
    }

    governor() {
        return this.eth_call(functions.governor, {})
    }

    hasPermission(owner: HasPermissionParams["owner"], manager: HasPermissionParams["manager"]) {
        return this.eth_call(functions.hasPermission, {owner, manager})
    }

    isAbsorbPaused() {
        return this.eth_call(functions.isAbsorbPaused, {})
    }

    isAllowed(_0: IsAllowedParams["_0"], _1: IsAllowedParams["_1"]) {
        return this.eth_call(functions.isAllowed, {_0, _1})
    }

    isBorrowCollateralized(account: IsBorrowCollateralizedParams["account"]) {
        return this.eth_call(functions.isBorrowCollateralized, {account})
    }

    isBuyPaused() {
        return this.eth_call(functions.isBuyPaused, {})
    }

    isLiquidatable(account: IsLiquidatableParams["account"]) {
        return this.eth_call(functions.isLiquidatable, {account})
    }

    isSupplyPaused() {
        return this.eth_call(functions.isSupplyPaused, {})
    }

    isTransferPaused() {
        return this.eth_call(functions.isTransferPaused, {})
    }

    isWithdrawPaused() {
        return this.eth_call(functions.isWithdrawPaused, {})
    }

    liquidatorPoints(_0: LiquidatorPointsParams["_0"]) {
        return this.eth_call(functions.liquidatorPoints, {_0})
    }

    numAssets() {
        return this.eth_call(functions.numAssets, {})
    }

    pauseGuardian() {
        return this.eth_call(functions.pauseGuardian, {})
    }

    quoteCollateral(asset: QuoteCollateralParams["asset"], baseAmount: QuoteCollateralParams["baseAmount"]) {
        return this.eth_call(functions.quoteCollateral, {asset, baseAmount})
    }

    storeFrontPriceFactor() {
        return this.eth_call(functions.storeFrontPriceFactor, {})
    }

    supplyKink() {
        return this.eth_call(functions.supplyKink, {})
    }

    supplyPerSecondInterestRateBase() {
        return this.eth_call(functions.supplyPerSecondInterestRateBase, {})
    }

    supplyPerSecondInterestRateSlopeHigh() {
        return this.eth_call(functions.supplyPerSecondInterestRateSlopeHigh, {})
    }

    supplyPerSecondInterestRateSlopeLow() {
        return this.eth_call(functions.supplyPerSecondInterestRateSlopeLow, {})
    }

    targetReserves() {
        return this.eth_call(functions.targetReserves, {})
    }

    totalBorrow() {
        return this.eth_call(functions.totalBorrow, {})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }

    totalsCollateral(_0: TotalsCollateralParams["_0"]) {
        return this.eth_call(functions.totalsCollateral, {_0})
    }

    trackingIndexScale() {
        return this.eth_call(functions.trackingIndexScale, {})
    }

    userBasic(_0: UserBasicParams["_0"]) {
        return this.eth_call(functions.userBasic, {_0})
    }

    userCollateral(_0: UserCollateralParams["_0"], _1: UserCollateralParams["_1"]) {
        return this.eth_call(functions.userCollateral, {_0, _1})
    }

    userNonce(_0: UserNonceParams["_0"]) {
        return this.eth_call(functions.userNonce, {_0})
    }
}

/// Event types
export type AbsorbCollateralEventArgs = EParams<typeof events.AbsorbCollateral>
export type AbsorbDebtEventArgs = EParams<typeof events.AbsorbDebt>
export type BuyCollateralEventArgs = EParams<typeof events.BuyCollateral>
export type PauseActionEventArgs = EParams<typeof events.PauseAction>
export type SupplyEventArgs = EParams<typeof events.Supply>
export type SupplyCollateralEventArgs = EParams<typeof events.SupplyCollateral>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type TransferCollateralEventArgs = EParams<typeof events.TransferCollateral>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>
export type WithdrawCollateralEventArgs = EParams<typeof events.WithdrawCollateral>
export type WithdrawReservesEventArgs = EParams<typeof events.WithdrawReserves>

/// Function types
export type AbsorbParams = FunctionArguments<typeof functions.absorb>
export type AbsorbReturn = FunctionReturn<typeof functions.absorb>

export type AccrueAccountParams = FunctionArguments<typeof functions.accrueAccount>
export type AccrueAccountReturn = FunctionReturn<typeof functions.accrueAccount>

export type ApproveThisParams = FunctionArguments<typeof functions.approveThis>
export type ApproveThisReturn = FunctionReturn<typeof functions.approveThis>

export type AssetListParams = FunctionArguments<typeof functions.assetList>
export type AssetListReturn = FunctionReturn<typeof functions.assetList>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BaseBorrowMinParams = FunctionArguments<typeof functions.baseBorrowMin>
export type BaseBorrowMinReturn = FunctionReturn<typeof functions.baseBorrowMin>

export type BaseMinForRewardsParams = FunctionArguments<typeof functions.baseMinForRewards>
export type BaseMinForRewardsReturn = FunctionReturn<typeof functions.baseMinForRewards>

export type BaseScaleParams = FunctionArguments<typeof functions.baseScale>
export type BaseScaleReturn = FunctionReturn<typeof functions.baseScale>

export type BaseTokenParams = FunctionArguments<typeof functions.baseToken>
export type BaseTokenReturn = FunctionReturn<typeof functions.baseToken>

export type BaseTokenPriceFeedParams = FunctionArguments<typeof functions.baseTokenPriceFeed>
export type BaseTokenPriceFeedReturn = FunctionReturn<typeof functions.baseTokenPriceFeed>

export type BaseTrackingBorrowSpeedParams = FunctionArguments<typeof functions.baseTrackingBorrowSpeed>
export type BaseTrackingBorrowSpeedReturn = FunctionReturn<typeof functions.baseTrackingBorrowSpeed>

export type BaseTrackingSupplySpeedParams = FunctionArguments<typeof functions.baseTrackingSupplySpeed>
export type BaseTrackingSupplySpeedReturn = FunctionReturn<typeof functions.baseTrackingSupplySpeed>

export type BorrowBalanceOfParams = FunctionArguments<typeof functions.borrowBalanceOf>
export type BorrowBalanceOfReturn = FunctionReturn<typeof functions.borrowBalanceOf>

export type BorrowKinkParams = FunctionArguments<typeof functions.borrowKink>
export type BorrowKinkReturn = FunctionReturn<typeof functions.borrowKink>

export type BorrowPerSecondInterestRateBaseParams = FunctionArguments<typeof functions.borrowPerSecondInterestRateBase>
export type BorrowPerSecondInterestRateBaseReturn = FunctionReturn<typeof functions.borrowPerSecondInterestRateBase>

export type BorrowPerSecondInterestRateSlopeHighParams = FunctionArguments<typeof functions.borrowPerSecondInterestRateSlopeHigh>
export type BorrowPerSecondInterestRateSlopeHighReturn = FunctionReturn<typeof functions.borrowPerSecondInterestRateSlopeHigh>

export type BorrowPerSecondInterestRateSlopeLowParams = FunctionArguments<typeof functions.borrowPerSecondInterestRateSlopeLow>
export type BorrowPerSecondInterestRateSlopeLowReturn = FunctionReturn<typeof functions.borrowPerSecondInterestRateSlopeLow>

export type BuyCollateralParams = FunctionArguments<typeof functions.buyCollateral>
export type BuyCollateralReturn = FunctionReturn<typeof functions.buyCollateral>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type ExtensionDelegateParams = FunctionArguments<typeof functions.extensionDelegate>
export type ExtensionDelegateReturn = FunctionReturn<typeof functions.extensionDelegate>

export type GetAssetInfoParams = FunctionArguments<typeof functions.getAssetInfo>
export type GetAssetInfoReturn = FunctionReturn<typeof functions.getAssetInfo>

export type GetAssetInfoByAddressParams = FunctionArguments<typeof functions.getAssetInfoByAddress>
export type GetAssetInfoByAddressReturn = FunctionReturn<typeof functions.getAssetInfoByAddress>

export type GetBorrowRateParams = FunctionArguments<typeof functions.getBorrowRate>
export type GetBorrowRateReturn = FunctionReturn<typeof functions.getBorrowRate>

export type GetCollateralReservesParams = FunctionArguments<typeof functions.getCollateralReserves>
export type GetCollateralReservesReturn = FunctionReturn<typeof functions.getCollateralReserves>

export type GetPriceParams = FunctionArguments<typeof functions.getPrice>
export type GetPriceReturn = FunctionReturn<typeof functions.getPrice>

export type GetReservesParams = FunctionArguments<typeof functions.getReserves>
export type GetReservesReturn = FunctionReturn<typeof functions.getReserves>

export type GetSupplyRateParams = FunctionArguments<typeof functions.getSupplyRate>
export type GetSupplyRateReturn = FunctionReturn<typeof functions.getSupplyRate>

export type GetUtilizationParams = FunctionArguments<typeof functions.getUtilization>
export type GetUtilizationReturn = FunctionReturn<typeof functions.getUtilization>

export type GovernorParams = FunctionArguments<typeof functions.governor>
export type GovernorReturn = FunctionReturn<typeof functions.governor>

export type HasPermissionParams = FunctionArguments<typeof functions.hasPermission>
export type HasPermissionReturn = FunctionReturn<typeof functions.hasPermission>

export type InitializeStorageParams = FunctionArguments<typeof functions.initializeStorage>
export type InitializeStorageReturn = FunctionReturn<typeof functions.initializeStorage>

export type IsAbsorbPausedParams = FunctionArguments<typeof functions.isAbsorbPaused>
export type IsAbsorbPausedReturn = FunctionReturn<typeof functions.isAbsorbPaused>

export type IsAllowedParams = FunctionArguments<typeof functions.isAllowed>
export type IsAllowedReturn = FunctionReturn<typeof functions.isAllowed>

export type IsBorrowCollateralizedParams = FunctionArguments<typeof functions.isBorrowCollateralized>
export type IsBorrowCollateralizedReturn = FunctionReturn<typeof functions.isBorrowCollateralized>

export type IsBuyPausedParams = FunctionArguments<typeof functions.isBuyPaused>
export type IsBuyPausedReturn = FunctionReturn<typeof functions.isBuyPaused>

export type IsLiquidatableParams = FunctionArguments<typeof functions.isLiquidatable>
export type IsLiquidatableReturn = FunctionReturn<typeof functions.isLiquidatable>

export type IsSupplyPausedParams = FunctionArguments<typeof functions.isSupplyPaused>
export type IsSupplyPausedReturn = FunctionReturn<typeof functions.isSupplyPaused>

export type IsTransferPausedParams = FunctionArguments<typeof functions.isTransferPaused>
export type IsTransferPausedReturn = FunctionReturn<typeof functions.isTransferPaused>

export type IsWithdrawPausedParams = FunctionArguments<typeof functions.isWithdrawPaused>
export type IsWithdrawPausedReturn = FunctionReturn<typeof functions.isWithdrawPaused>

export type LiquidatorPointsParams = FunctionArguments<typeof functions.liquidatorPoints>
export type LiquidatorPointsReturn = FunctionReturn<typeof functions.liquidatorPoints>

export type NumAssetsParams = FunctionArguments<typeof functions.numAssets>
export type NumAssetsReturn = FunctionReturn<typeof functions.numAssets>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PauseGuardianParams = FunctionArguments<typeof functions.pauseGuardian>
export type PauseGuardianReturn = FunctionReturn<typeof functions.pauseGuardian>

export type QuoteCollateralParams = FunctionArguments<typeof functions.quoteCollateral>
export type QuoteCollateralReturn = FunctionReturn<typeof functions.quoteCollateral>

export type StoreFrontPriceFactorParams = FunctionArguments<typeof functions.storeFrontPriceFactor>
export type StoreFrontPriceFactorReturn = FunctionReturn<typeof functions.storeFrontPriceFactor>

export type SupplyParams = FunctionArguments<typeof functions.supply>
export type SupplyReturn = FunctionReturn<typeof functions.supply>

export type SupplyFromParams = FunctionArguments<typeof functions.supplyFrom>
export type SupplyFromReturn = FunctionReturn<typeof functions.supplyFrom>

export type SupplyKinkParams = FunctionArguments<typeof functions.supplyKink>
export type SupplyKinkReturn = FunctionReturn<typeof functions.supplyKink>

export type SupplyPerSecondInterestRateBaseParams = FunctionArguments<typeof functions.supplyPerSecondInterestRateBase>
export type SupplyPerSecondInterestRateBaseReturn = FunctionReturn<typeof functions.supplyPerSecondInterestRateBase>

export type SupplyPerSecondInterestRateSlopeHighParams = FunctionArguments<typeof functions.supplyPerSecondInterestRateSlopeHigh>
export type SupplyPerSecondInterestRateSlopeHighReturn = FunctionReturn<typeof functions.supplyPerSecondInterestRateSlopeHigh>

export type SupplyPerSecondInterestRateSlopeLowParams = FunctionArguments<typeof functions.supplyPerSecondInterestRateSlopeLow>
export type SupplyPerSecondInterestRateSlopeLowReturn = FunctionReturn<typeof functions.supplyPerSecondInterestRateSlopeLow>

export type SupplyToParams = FunctionArguments<typeof functions.supplyTo>
export type SupplyToReturn = FunctionReturn<typeof functions.supplyTo>

export type TargetReservesParams = FunctionArguments<typeof functions.targetReserves>
export type TargetReservesReturn = FunctionReturn<typeof functions.targetReserves>

export type TotalBorrowParams = FunctionArguments<typeof functions.totalBorrow>
export type TotalBorrowReturn = FunctionReturn<typeof functions.totalBorrow>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TotalsCollateralParams = FunctionArguments<typeof functions.totalsCollateral>
export type TotalsCollateralReturn = FunctionReturn<typeof functions.totalsCollateral>

export type TrackingIndexScaleParams = FunctionArguments<typeof functions.trackingIndexScale>
export type TrackingIndexScaleReturn = FunctionReturn<typeof functions.trackingIndexScale>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferAssetParams = FunctionArguments<typeof functions.transferAsset>
export type TransferAssetReturn = FunctionReturn<typeof functions.transferAsset>

export type TransferAssetFromParams = FunctionArguments<typeof functions.transferAssetFrom>
export type TransferAssetFromReturn = FunctionReturn<typeof functions.transferAssetFrom>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type UserBasicParams = FunctionArguments<typeof functions.userBasic>
export type UserBasicReturn = FunctionReturn<typeof functions.userBasic>

export type UserCollateralParams = FunctionArguments<typeof functions.userCollateral>
export type UserCollateralReturn = FunctionReturn<typeof functions.userCollateral>

export type UserNonceParams = FunctionArguments<typeof functions.userNonce>
export type UserNonceReturn = FunctionReturn<typeof functions.userNonce>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawFromParams = FunctionArguments<typeof functions.withdrawFrom>
export type WithdrawFromReturn = FunctionReturn<typeof functions.withdrawFrom>

export type WithdrawReservesParams = FunctionArguments<typeof functions.withdrawReserves>
export type WithdrawReservesReturn = FunctionReturn<typeof functions.withdrawReserves>

export type WithdrawToParams = FunctionArguments<typeof functions.withdrawTo>
export type WithdrawToReturn = FunctionReturn<typeof functions.withdrawTo>

