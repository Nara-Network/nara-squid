import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BooleanColumn as BooleanColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {PortWithdrawalRequest} from "./portWithdrawalRequest.model"
import {PortDeposit} from "./portDeposit.model"
import {NaraRedemption} from "./naraRedemption.model"

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

    @BooleanColumn_({nullable: false})
    isTestnet!: boolean

    @OneToMany_(() => PortWithdrawalRequest, e => e.user)
    portWithdrawalRequests!: PortWithdrawalRequest[]

    @OneToMany_(() => PortDeposit, e => e.user)
    portDeposits!: PortDeposit[]

    @OneToMany_(() => NaraRedemption, e => e.user)
    naraRedemptions!: NaraRedemption[]
}
