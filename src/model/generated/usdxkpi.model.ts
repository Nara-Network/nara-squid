import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class USDXKPI {
    constructor(props?: Partial<USDXKPI>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("varchar", {length: 7, nullable: false})
    network!: Network

    @BigIntColumn_({nullable: false})
    totalUSDX!: bigint
}
