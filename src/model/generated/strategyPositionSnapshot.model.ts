import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class StrategyPositionSnapshot {
    constructor(props?: Partial<StrategyPositionSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Index_()
    @StringColumn_({nullable: false})
    strategyAddr!: string

    @Index_()
    @IntColumn_({nullable: false})
    lastReadTsSec!: number

    @BigIntColumn_({nullable: false})
    valueBaseRaw!: bigint

    @BigIntColumn_({nullable: true})
    principalBaseRaw!: bigint | undefined | null

    @StringColumn_({nullable: false})
    source!: string

    @BigIntColumn_({nullable: false})
    blockHeight!: bigint

    @IntColumn_({nullable: false})
    blockTimestampSec!: number

    @StringColumn_({nullable: true})
    txHash!: string | undefined | null
}
