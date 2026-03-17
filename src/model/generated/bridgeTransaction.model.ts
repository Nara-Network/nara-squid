import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"
import {Network} from "./_network"

@Entity_()
export class BridgeTransaction {
    constructor(props?: Partial<BridgeTransaction>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    asset!: Token

    @StringColumn_({nullable: false})
    srcAccount!: string

    @StringColumn_({nullable: true})
    destAccount!: string | undefined | null

    @Column_("varchar", {length: 7, nullable: false})
    srcChain!: Network

    @Column_("varchar", {length: 7, nullable: false})
    destChain!: Network

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @BigIntColumn_({nullable: true})
    receivedAmount!: bigint | undefined | null

    @StringColumn_({nullable: false})
    srcTxHash!: string

    @StringColumn_({nullable: true})
    destTxHash!: string | undefined | null

    @BigIntColumn_({nullable: false})
    approvalDate!: bigint

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @BigIntColumn_({nullable: false})
    accumulatedPoints!: bigint
}
