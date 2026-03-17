import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {StrategyKind} from "./_strategyKind"

@Entity_()
export class StrategyYieldState {
    constructor(props?: Partial<StrategyYieldState>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    network!: string

    @Index_()
    @Column_("varchar", {length: 9, nullable: false})
    kind!: StrategyKind

    @Index_()
    @StringColumn_({nullable: false})
    key!: string

    @IntColumn_({nullable: false})
    lastDayStartTs!: number

    @BigIntColumn_({nullable: false})
    indexWad!: bigint

    @IntColumn_({nullable: false})
    updatedAtTs!: number
}
