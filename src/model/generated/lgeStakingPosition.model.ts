import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, BooleanColumn as BooleanColumn_, OneToMany as OneToMany_, FloatColumn as FloatColumn_} from "@subsquid/typeorm-store"
import {User} from "./user.model"
import {LGEStakingHistory} from "./lgeStakingHistory.model"
import {Token} from "./token.model"

@Entity_()
export class LGEStakingPosition {
    constructor(props?: Partial<LGEStakingPosition>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => User, {nullable: true})
    user!: User

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @BigIntColumn_({nullable: false})
    updatedAt!: bigint

    @BooleanColumn_({nullable: false})
    isActive!: boolean

    @OneToMany_(() => LGEStakingHistory, e => e.position)
    stakingHistory!: LGEStakingHistory[]

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    stakedToken!: Token

    @FloatColumn_({nullable: false})
    totalPoints!: number

    @BigIntColumn_({nullable: false})
    pointsUpdatedAtBlock!: bigint
}
