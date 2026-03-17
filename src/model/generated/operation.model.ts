import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import * as marshal from "./marshal"
import {Ozean} from "./ozean.model"
import {OperationType} from "./_operationType"
import {Token} from "./token.model"
import {OperationMedium} from "./_operationMedium"
import {OperationPersona} from "./_operationPersona"
import {OperationSnapshot} from "./_operationSnapshot"

@Entity_()
export class Operation {
    constructor(props?: Partial<Operation>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: true})
    hash!: string | undefined | null

    @Index_()
    @ManyToOne_(() => Ozean, {nullable: true})
    ozean!: Ozean | undefined | null

    @Column_("varchar", {length: 22, nullable: false})
    type!: OperationType

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    currency!: Token

    @Column_("varchar", {length: 9, nullable: false})
    medium!: OperationMedium

    @Column_("varchar", {length: 8, array: true, nullable: false})
    persona!: (OperationPersona)[]

    @BigIntColumn_({nullable: true})
    amount!: bigint | undefined | null

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @Column_("jsonb", {transformer: {to: obj => obj == null ? undefined : obj.toJSON(), from: obj => obj == null ? undefined : new OperationSnapshot(undefined, obj)}, nullable: true})
    snapshot!: OperationSnapshot | undefined | null

    @Index_()
    @StringColumn_({nullable: false})
    account!: string
}
