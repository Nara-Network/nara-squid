import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, ManyToOne as ManyToOne_, BigDecimalColumn as BigDecimalColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"
import {User} from "./user.model"

@Entity_()
export class ReferredUserPoints {
    constructor(props?: Partial<ReferredUserPoints>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 7, nullable: false})
    network!: Network

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    referee!: User

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    referredUser!: User

    @BigDecimalColumn_({nullable: false})
    points!: BigDecimal
}
