import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class PortVaultApyChart {
    constructor(props?: Partial<PortVaultApyChart>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @BigIntColumn_({nullable: false})
    apy7d!: bigint

    @BigIntColumn_({nullable: false})
    apy30d!: bigint

    @BigIntColumn_({nullable: false})
    apy365d!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    block!: bigint

    @BigIntColumn_({nullable: false})
    exchangeRate!: bigint

    @BigIntColumn_({nullable: false})
    exchangeRate7dAgo!: bigint

    @BigIntColumn_({nullable: false})
    exchangeRate30dAgo!: bigint

    @BigIntColumn_({nullable: false})
    exchangeRate365dAgo!: bigint
}
