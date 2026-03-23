import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, BigDecimalColumn as BigDecimalColumn_, BooleanColumn as BooleanColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @StringColumn_({nullable: false})
    name!: string

    @Index_()
    @StringColumn_({nullable: false})
    symbol!: string

    @BigIntColumn_({nullable: false})
    decimals!: bigint

    @BigDecimalColumn_({nullable: false})
    price!: BigDecimal

    @BooleanColumn_({nullable: false})
    isPoolToken!: boolean

    @StringColumn_({nullable: true})
    coinGeckoId!: string | undefined | null

    @IntColumn_({nullable: false})
    tvlMultiplier!: number
}
