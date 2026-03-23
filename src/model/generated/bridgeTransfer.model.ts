import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"
import {BridgeStatus} from "./_bridgeStatus"
import {Token} from "./token.model"

@Entity_()
export class BridgeTransfer {
    constructor(props?: Partial<BridgeTransfer>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    recipient!: string

    @Index_()
    @StringColumn_({nullable: false})
    sender!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @Column_("varchar", {length: 16, nullable: false})
    destination!: Network

    @Column_("varchar", {length: 16, nullable: false})
    origin!: Network

    @Column_("varchar", {length: 10, nullable: false})
    status!: BridgeStatus

    @BigIntColumn_({nullable: false})
    fee!: bigint

    @BigIntColumn_({nullable: false})
    amountSent!: bigint

    @BigIntColumn_({nullable: false})
    amountReceived!: bigint

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token!: Token | undefined | null

    @Index_()
    @StringColumn_({nullable: true})
    originTxHash!: string | undefined | null

    @StringColumn_({nullable: true})
    destinationTxHash!: string | undefined | null

    @StringColumn_({nullable: true})
    provenTxHash!: string | undefined | null

    @BooleanColumn_({nullable: false})
    isTestnet!: boolean

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @BigIntColumn_({nullable: true})
    receivedAt!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    provenAt!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    finalizedAt!: bigint | undefined | null
}
