import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class BlockBatchAudit {
    constructor(props?: Partial<BlockBatchAudit>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @Index_()
    @BigIntColumn_({nullable: false})
    firstHeight!: bigint

    @Index_()
    @BigIntColumn_({nullable: false})
    lastHeight!: bigint

    @IntColumn_({nullable: false})
    count!: number

    @IntColumn_({nullable: false})
    expectedCount!: number

    @BigIntColumn_({nullable: false})
    startedAt!: bigint

    @BigIntColumn_({nullable: false})
    finishedAt!: bigint
}
