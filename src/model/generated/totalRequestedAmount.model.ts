import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class TotalRequestedAmount {
    constructor(props?: Partial<TotalRequestedAmount>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    collateralAddress!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint
}
