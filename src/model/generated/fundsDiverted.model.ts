import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class FundsDiverted {
    constructor(props?: Partial<FundsDiverted>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    strategy!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    txHash!: string
}
