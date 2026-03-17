import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class ExpectedExchangeRate {
    constructor(props?: Partial<ExpectedExchangeRate>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

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
    strategyYieldBase!: bigint

    @IntColumn_({nullable: false})
    lastSnapshotTsUsed!: number

    @BigIntColumn_({nullable: false})
    commitFeeRemainderNumerator!: bigint

    @BigIntColumn_({nullable: false})
    borrowInterestRemainderNumerator!: bigint
}
