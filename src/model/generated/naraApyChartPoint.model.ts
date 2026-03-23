import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class NaraApyChartPoint {
    constructor(props?: Partial<NaraApyChartPoint>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @Index_()
    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    block!: bigint

    @BigIntColumn_({nullable: false})
    apy7d!: bigint

    @BigIntColumn_({nullable: false})
    apy14d!: bigint

    @BigIntColumn_({nullable: false})
    apy30d!: bigint
}
