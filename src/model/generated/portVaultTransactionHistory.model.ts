import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {User} from "./user.model"
import {PortVaultTxAction} from "./_portVaultTxAction"

@Entity_()
export class PortVaultTransactionHistory {
    constructor(props?: Partial<PortVaultTransactionHistory>) {
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

    @Column_("varchar", {length: 28, nullable: false})
    action!: PortVaultTxAction

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @StringColumn_({nullable: false})
    asset!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string
}
