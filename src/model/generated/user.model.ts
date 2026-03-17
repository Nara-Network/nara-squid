import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigDecimalColumn as BigDecimalColumn_, OneToMany as OneToMany_, ManyToOne as ManyToOne_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"
import {ReferredUserPoints} from "./referredUserPoints.model"
import {LGEStakingPosition} from "./lgeStakingPosition.model"
import {PortWithdrawalRequest} from "./portWithdrawalRequest.model"
import {PortDeposit} from "./portDeposit.model"

@Entity_()
export class User {
    constructor(props?: Partial<User>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    @BigDecimalColumn_({nullable: false})
    totalPoints!: BigDecimal

    @BigDecimalColumn_({nullable: false})
    referralPoints!: BigDecimal

    @BigDecimalColumn_({nullable: false})
    referralCodePoints!: BigDecimal

    @OneToMany_(() => ReferredUserPoints, e => e.referee)
    referredUsersPoints!: ReferredUserPoints[]

    @BigDecimalColumn_({nullable: false})
    lgePoints!: BigDecimal

    @StringColumn_({nullable: true})
    referralCode!: string | undefined | null

    @StringColumn_({nullable: true})
    referredCode!: string | undefined | null

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    referredBy!: User | undefined | null

    @BigIntColumn_({nullable: true})
    referredAt!: bigint | undefined | null

    @OneToMany_(() => User, e => e.referredBy)
    referredUsers!: User[]

    @OneToMany_(() => LGEStakingPosition, e => e.user)
    stakingPositions!: LGEStakingPosition[]

    @BigDecimalColumn_({nullable: false})
    tvl!: BigDecimal

    @IntColumn_({nullable: false})
    leaderboardPosition!: number

    @BigIntColumn_({nullable: false})
    totalBridgeTransfers!: bigint

    @BooleanColumn_({nullable: false})
    isTestnet!: boolean

    @OneToMany_(() => PortWithdrawalRequest, e => e.user)
    portWithdrawalRequests!: PortWithdrawalRequest[]

    @OneToMany_(() => PortDeposit, e => e.user)
    portDeposits!: PortDeposit[]
}
