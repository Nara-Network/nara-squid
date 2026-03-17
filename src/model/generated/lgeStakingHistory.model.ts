import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {LGEStakingPosition} from "./lgeStakingPosition.model"
import {LGEStakingAction} from "./_lgeStakingAction"

@Entity_()
export class LGEStakingHistory {
    constructor(props?: Partial<LGEStakingHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => LGEStakingPosition, {nullable: true})
    position!: LGEStakingPosition

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @Column_("varchar", {length: 13, nullable: false})
    action!: LGEStakingAction

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @StringColumn_({nullable: false})
    txHash!: string

    @BigIntColumn_({nullable: false})
    block!: bigint
}
