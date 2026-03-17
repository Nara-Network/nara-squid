import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"
import {Ozean} from "./ozean.model"

@Entity_()
export class RewardToken {
    constructor(props?: Partial<RewardToken>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token!: Token

    @Index_()
    @ManyToOne_(() => Ozean, {nullable: true})
    ozean!: Ozean | undefined | null

    @BigIntColumn_({nullable: false})
    rate!: bigint
}
