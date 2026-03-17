import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {PortVaultAction} from "./_portVaultAction"

@Entity_()
export class PortVaultActivity {
    constructor(props?: Partial<PortVaultActivity>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Column_("varchar", {length: 28, nullable: false})
    action!: PortVaultAction

    @StringColumn_({nullable: false})
    details!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string
}
