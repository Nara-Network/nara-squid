import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {NaraRedemption} from "./naraRedemption.model"
import {NaraRedemptionAction} from "./_naraRedemptionAction"

@Entity_()
export class NaraRedemptionActivity {
    constructor(props?: Partial<NaraRedemptionActivity>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => NaraRedemption, {nullable: true})
    redemption!: NaraRedemption

    @Index_()
    @Column_("varchar", {length: 14, nullable: false})
    action!: NaraRedemptionAction

    @BigIntColumn_({nullable: false})
    naraUsdAmount!: bigint

    @BigIntColumn_({nullable: true})
    collateralAmount!: bigint | undefined | null

    @Index_()
    @StringColumn_({nullable: false})
    collateralAssetAddress!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @Index_()
    @StringColumn_({nullable: false})
    txHash!: string

    @BigIntColumn_({nullable: false})
    block!: bigint
}
