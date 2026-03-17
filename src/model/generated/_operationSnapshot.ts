import assert from "assert"
import * as marshal from "./marshal"

export class OperationSnapshot {
    private _apr!: bigint
    private _exchangeRate!: bigint
    private _balance!: bigint

    constructor(props?: Partial<Omit<OperationSnapshot, 'toJSON'>>, json?: any) {
        Object.assign(this, props)
        if (json != null) {
            this._apr = marshal.bigint.fromJSON(json.apr)
            this._exchangeRate = marshal.bigint.fromJSON(json.exchangeRate)
            this._balance = marshal.bigint.fromJSON(json.balance)
        }
    }

    get apr(): bigint {
        assert(this._apr != null, 'uninitialized access')
        return this._apr
    }

    set apr(value: bigint) {
        this._apr = value
    }

    get exchangeRate(): bigint {
        assert(this._exchangeRate != null, 'uninitialized access')
        return this._exchangeRate
    }

    set exchangeRate(value: bigint) {
        this._exchangeRate = value
    }

    get balance(): bigint {
        assert(this._balance != null, 'uninitialized access')
        return this._balance
    }

    set balance(value: bigint) {
        this._balance = value
    }

    toJSON(): object {
        return {
            apr: marshal.bigint.toJSON(this.apr),
            exchangeRate: marshal.bigint.toJSON(this.exchangeRate),
            balance: marshal.bigint.toJSON(this.balance),
        }
    }
}
