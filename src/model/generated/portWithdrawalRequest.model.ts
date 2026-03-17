import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {User} from "./user.model"
import {PortWithdrawalRequestStatus} from "./_portWithdrawalRequestStatus"
import {Token} from "./token.model"

@Entity_()
export class PortWithdrawalRequest {
    constructor(props?: Partial<PortWithdrawalRequest>) {
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

    @Index_()
    @Column_("varchar", {length: 9, nullable: false})
    status!: PortWithdrawalRequestStatus

    @BigIntColumn_({nullable: false})
    wantAmount!: bigint

    @BigIntColumn_({nullable: false})
    offerAmount!: bigint

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    wantToken!: Token

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string

    @BigIntColumn_({nullable: false})
    block!: bigint

    @BigIntColumn_({nullable: false})
    deadline!: bigint
}
