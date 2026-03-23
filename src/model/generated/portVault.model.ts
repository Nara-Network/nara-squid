import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, ManyToOne as ManyToOne_} from "@subsquid/typeorm-store"
import {PortVaultType} from "./_portVaultType"
import {Network} from "./_network"
import {PortVaultStatus} from "./_portVaultStatus"
import {Token} from "./token.model"

@Entity_()
export class PortVault {
    constructor(props?: Partial<PortVault>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    @Column_("varchar", {length: 8, nullable: false})
    type!: PortVaultType

    @BigIntColumn_({nullable: false})
    startedAt!: bigint

    @Column_("varchar", {length: 16, nullable: false})
    network!: Network

    @StringColumn_({nullable: false})
    symbol!: string

    @IntColumn_({nullable: false})
    decimals!: number

    @StringColumn_({nullable: false})
    name!: string

    @BigIntColumn_({nullable: false})
    managementFee!: bigint

    @BigIntColumn_({nullable: false})
    currentNav!: bigint

    @BigIntColumn_({nullable: false})
    apy!: bigint

    @BigIntColumn_({nullable: false})
    tvl!: bigint

    @BigIntColumn_({nullable: false})
    avg7dApy!: bigint

    @BigIntColumn_({nullable: false})
    avg30dApy!: bigint

    @BigIntColumn_({nullable: false})
    avg1yApy!: bigint

    @IntColumn_({nullable: false})
    riskLevel!: number

    @BigIntColumn_({nullable: false})
    depositCap!: bigint

    @BigIntColumn_({nullable: false})
    totalWithdrawalRequestsInBaseToken!: bigint

    @BigIntColumn_({nullable: false})
    totalPendingWithdrawalRequests!: bigint

    @BigIntColumn_({nullable: false})
    totalActivity!: bigint

    @Column_("varchar", {length: 6, nullable: false})
    status!: PortVaultStatus

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    baseToken!: Token

    @StringColumn_({array: true, nullable: false})
    assets!: (string)[]

    @StringColumn_({nullable: false})
    teller!: string

    @StringColumn_({nullable: false})
    accountant!: string

    @StringColumn_({nullable: false})
    atomicQueue!: string

    @StringColumn_({nullable: false})
    atomicSolver!: string

    @StringColumn_({nullable: false})
    rolesAuthority!: string

    @StringColumn_({nullable: false})
    manager!: string

    @BigIntColumn_({nullable: false})
    fundsDiverted!: bigint
}
