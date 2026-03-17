import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, BooleanColumn as BooleanColumn_, ManyToOne as ManyToOne_} from "@subsquid/typeorm-store"
import {Ozean} from "./ozean.model"

@Entity_()
export class Stake {
    constructor(props?: Partial<Stake>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    owner!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @BooleanColumn_({nullable: false})
    unstaked!: boolean

    @BigIntColumn_({nullable: false})
    withdrawnReward!: bigint

    @BigIntColumn_({nullable: false})
    withdrawableReward!: bigint

    @Index_()
    @ManyToOne_(() => Ozean, {nullable: true})
    ozean!: Ozean | undefined | null
}
