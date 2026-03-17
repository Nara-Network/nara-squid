import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {BridgeStatus} from "./_bridgeStatus"
import {BridgeTransaction} from "./bridgeTransaction.model"

@Entity_()
export class BridgeWithdrawal {
    constructor(props?: Partial<BridgeWithdrawal>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("varchar", {length: 10, nullable: true})
    status!: BridgeStatus | undefined | null

    @Index_()
    @ManyToOne_(() => BridgeTransaction, {nullable: true})
    bridge!: BridgeTransaction

    @BigIntColumn_({nullable: false})
    withdrawalDate!: bigint

    @StringColumn_({nullable: true})
    approvalTxHash!: string | undefined | null

    @StringColumn_({nullable: true})
    withdrawalTxHash!: string | undefined | null
}
