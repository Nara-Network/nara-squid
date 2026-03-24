import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {User} from "./user.model"
import {NaraRedemptionStatus} from "./_naraRedemptionStatus"
import {NaraRedemptionActivity} from "./naraRedemptionActivity.model"

@Entity_()
export class NaraRedemption {
    constructor(props?: Partial<NaraRedemption>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    user!: User

    @Index_()
    @Column_("varchar", {length: 9, nullable: false})
    status!: NaraRedemptionStatus

    @BigIntColumn_({nullable: false})
    naraUsdAmount!: bigint

    @BigIntColumn_({nullable: true})
    collateralAmount!: bigint | undefined | null

    @Index_()
    @StringColumn_({nullable: false})
    collateralAssetAddress!: string

    @BigIntColumn_({nullable: false})
    requestedAt!: bigint

    @BigIntColumn_({nullable: true})
    completedAt!: bigint | undefined | null

    @BigIntColumn_({nullable: false})
    updatedAt!: bigint

    @OneToMany_(() => NaraRedemptionActivity, e => e.redemption)
    activities!: NaraRedemptionActivity[]
}
