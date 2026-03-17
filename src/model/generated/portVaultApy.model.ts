import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class PortVaultAPY {
    constructor(props?: Partial<PortVaultAPY>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @BigIntColumn_({nullable: false})
    apy!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    block!: bigint
}
