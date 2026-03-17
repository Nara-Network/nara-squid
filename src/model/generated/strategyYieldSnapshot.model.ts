import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {StrategyKind} from "./_strategyKind"

@Entity_()
export class StrategyYieldSnapshot {
    constructor(props?: Partial<StrategyYieldSnapshot>) {
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

    @Index_()
    @IntColumn_({nullable: false})
    dayStartTs!: number

    @BigIntColumn_({nullable: false})
    indexWad!: bigint

    @IntColumn_({nullable: false})
    updatedAtTs!: number
}
