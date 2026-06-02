import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, BigIntColumn as BigIntColumn_, BigDecimalColumn as BigDecimalColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class NaraSupplyChartPoint {
    constructor(props?: Partial<NaraSupplyChartPoint>) {
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
    naraUsdSupply!: bigint

    @BigDecimalColumn_({nullable: false})
    naraUsdSupplyFormatted!: BigDecimal

    @BigIntColumn_({nullable: true})
    naraUsdPlusTotalAssets!: bigint | undefined | null

    @BigDecimalColumn_({nullable: true})
    naraUsdPlusTotalAssetsFormatted!: BigDecimal | undefined | null
}
