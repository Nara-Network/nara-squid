import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigDecimalColumn as BigDecimalColumn_, Index as Index_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class LgeGlobalStats {
    constructor(props?: Partial<LgeGlobalStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigDecimalColumn_({nullable: false})
    totalPoints!: BigDecimal

    @BigDecimalColumn_({nullable: false})
    totalDeposited!: BigDecimal

    @Index_()
    @Column_("varchar", {length: 7, nullable: false})
    network!: Network
}
