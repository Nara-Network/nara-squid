import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"
import {PortVaultStatus} from "./_portVaultStatus"

@Entity_()
export class PortVaultStatusUpdate {
    constructor(props?: Partial<PortVaultStatusUpdate>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Column_("varchar", {length: 6, nullable: false})
    newStatus!: PortVaultStatus

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string

    @BigIntColumn_({nullable: false})
    block!: bigint
}
