import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Index as Index_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"

@Entity_()
export class BridgeToken {
    constructor(props?: Partial<BridgeToken>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    depositCap!: bigint

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    asset!: Token
}
