import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class NaraTvlChartPoint {
    constructor(props?: Partial<NaraTvlChartPoint>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @Index_()
    @StringColumn_({nullable: false})
    chain!: string

    @Index_()
    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    block!: bigint

    @BigIntColumn_({nullable: false})
    tvlUsd!: bigint
}
