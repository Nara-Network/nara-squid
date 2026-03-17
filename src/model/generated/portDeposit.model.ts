import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {User} from "./user.model"
import {Token} from "./token.model"

@Entity_()
export class PortDeposit {
    constructor(props?: Partial<PortDeposit>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    user!: User

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @BigIntColumn_({nullable: false})
    shares!: bigint

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    asset!: Token

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string

    @BigIntColumn_({nullable: false})
    block!: bigint
}
