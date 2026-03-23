import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {Network} from "./_network"

@Entity_()
export class ExpectedExchangeRateSnapshot {
    constructor(props?: Partial<ExpectedExchangeRateSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @Index_()
    @StringColumn_({nullable: false})
    vaultAddress!: string

    @Index_()
    @BigIntColumn_({nullable: false})
    blockHeight!: bigint

    @BigIntColumn_({nullable: false})
    blockTimestampMs!: bigint

    @IntColumn_({nullable: false})
    nowSec!: number

    @Index_()
    @IntColumn_({nullable: false})
    updateTs!: number

    @BigIntColumn_({nullable: false})
    block!: bigint

    @IntColumn_({nullable: false})
    blockTimestamp!: number

    @IntColumn_({nullable: false})
    expectedLastAccrualTs!: number

    @IntColumn_({nullable: false})
    expectedLastUpdateTs!: number

    @BigIntColumn_({nullable: false})
    expectedAssetsBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    expectedBorrowedBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    expectedBorrowedPrincipalBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    expectedExchangeRateBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    commitmentFeeAccruedMtdBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    commitmentFeeProjectedMonthEndBaseRaw!: bigint

    @IntColumn_({nullable: false})
    commitmentFeeMtdMonthStartTs!: number

    @BigIntColumn_({nullable: false})
    borrowInterestAccruedMtdBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    borrowInterestProjectedMonthEndBaseRaw!: bigint

    @IntColumn_({nullable: false})
    borrowInterestMtdMonthStartTs!: number

    @BigIntColumn_({nullable: false})
    expectedRepaymentPendingBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    expectedRepaymentCreditBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    borrowRateBps!: bigint

    @BigIntColumn_({nullable: false})
    commitmentFeeRateBps!: bigint

    @BigIntColumn_({nullable: false})
    totalSharesTracked!: bigint

    @StringColumn_({nullable: false})
    totalSharesSource!: string

    @BigIntColumn_({nullable: false})
    netAssetsTrackedBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    idleBaseTracked!: bigint

    @BigIntColumn_({nullable: false})
    investedBaseTracked!: bigint

    @BigIntColumn_({nullable: false})
    accruedCommitmentFeeBase!: bigint

    @BigIntColumn_({nullable: false})
    accruedBorrowInterestBase!: bigint

    @BigIntColumn_({nullable: false})
    lastAccrualBlock!: bigint

    @BigIntColumn_({nullable: false})
    utilizationBps!: bigint

    @BigIntColumn_({nullable: false})
    idleBase!: bigint

    @BigIntColumn_({nullable: false})
    investedBase!: bigint

    @BigIntColumn_({nullable: false})
    effectiveStrategyValueBase!: bigint

    @BigIntColumn_({nullable: false})
    borrowedPrincipalBase!: bigint

    @BigIntColumn_({nullable: false})
    borrowedForTier!: bigint

    @BigIntColumn_({nullable: false})
    borrowedReported!: bigint

    @BigIntColumn_({nullable: false})
    utilForTierBps!: bigint

    @BigIntColumn_({nullable: false})
    utilReportedBps!: bigint

    @BigIntColumn_({nullable: false})
    netAssetsBase!: bigint

    @BigIntColumn_({nullable: false})
    eer!: bigint

    @BigIntColumn_({nullable: false})
    totalAssetsBase!: bigint

    @IntColumn_({nullable: false})
    dtSeconds!: number

    @BigIntColumn_({nullable: false})
    commitmentFeeAccruedDeltaBase!: bigint

    @BigIntColumn_({nullable: false})
    borrowInterestAccruedDeltaBase!: bigint

    @BigIntColumn_({nullable: false})
    utilForTierBpsStart!: bigint

    @BigIntColumn_({nullable: false})
    commitFeeRateBpsStart!: bigint

    @BigIntColumn_({nullable: false})
    batchFirstBlock!: bigint

    @BigIntColumn_({nullable: false})
    batchLastBlock!: bigint

    @IntColumn_({nullable: false})
    batchCount!: number

    @IntColumn_({nullable: false})
    hourTs!: number

    @IntColumn_({nullable: false})
    lastAccrualTsBefore!: number

    @IntColumn_({nullable: false})
    lastAccrualTsAfter!: number

    @BigIntColumn_({nullable: false})
    utilBpsEnd!: bigint
}
