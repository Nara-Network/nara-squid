import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, BigIntColumn as BigIntColumn_, BigDecimalColumn as BigDecimalColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class NaraGlobalStats {
    constructor(props?: Partial<NaraGlobalStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @BigIntColumn_({nullable: false})
    naraUsdSupply!: bigint

    @BigDecimalColumn_({nullable: false})
    naraUsdSupplyFormatted!: BigDecimal

    @IntColumn_({nullable: false})
    naraUsdDecimals!: number

    @BigDecimalColumn_({nullable: false})
    percentageStaked!: BigDecimal

    @BigIntColumn_({nullable: false})
    updatedAt!: bigint
}
