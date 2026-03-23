import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, BigDecimalColumn as BigDecimalColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Token} from "./token.model"
import {Network} from "./_network"
import {PoolStatus} from "./_poolStatus"
import {Operation} from "./operation.model"
import {Stake} from "./stake.model"
import {RewardToken} from "./rewardToken.model"

@Entity_()
export class Ozean {
    constructor(props?: Partial<Ozean>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    asset!: Token

    @StringColumn_({nullable: false})
    symbol!: string

    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @Column_("varchar", {length: 18, nullable: false})
    status!: PoolStatus

    @BigIntColumn_({nullable: false})
    totalStake!: bigint

    @BigIntColumn_({nullable: false})
    totalUSDXEarned!: bigint

    @BigIntColumn_({nullable: false})
    exchangeRate!: bigint

    @BigDecimalColumn_({nullable: false})
    apr!: BigDecimal

    @BigIntColumn_({nullable: false})
    lastUpdatedAt!: bigint

    @OneToMany_(() => Operation, e => e.ozean)
    operations!: Operation[]

    @OneToMany_(() => Stake, e => e.ozean)
    stakes!: Stake[]

    @OneToMany_(() => RewardToken, e => e.ozean)
    rewardAssets!: RewardToken[]
}
