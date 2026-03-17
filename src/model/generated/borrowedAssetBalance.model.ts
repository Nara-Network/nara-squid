import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {PortVault} from "./portVault.model"

@Entity_()
export class BorrowedAssetBalance {
    constructor(props?: Partial<BorrowedAssetBalance>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => PortVault, {nullable: true})
    vault!: PortVault

    @Index_()
    @StringColumn_({nullable: false})
    vaultAddress!: string

    @Index_()
    @StringColumn_({nullable: false})
    borrower!: string

    @Index_()
    @StringColumn_({nullable: false})
    token!: string

    @IntColumn_({nullable: false})
    tokenDecimals!: number

    @BigIntColumn_({nullable: false})
    amountRaw!: bigint

    @BigIntColumn_({nullable: false})
    amountBaseRaw!: bigint

    @BigIntColumn_({nullable: false})
    updatedAtTs!: bigint

    @StringColumn_({nullable: false})
    lastTxHash!: string
}
