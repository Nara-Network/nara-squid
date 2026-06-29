module.exports = class Data1780381162766 {
    name = 'Data1780381162766'

    async up(db) {
        // Additive column for the latest NaraUSD+ vestingAmount() read at the head
        // block. NOT NULL with a 0 default so existing nara_global_stats rows remain
        // valid; the processor overwrites it on the next head update.
        await db.query(`ALTER TABLE "nara_global_stats" ADD "nara_usd_plus_vesting_amount" numeric NOT NULL DEFAULT 0`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "nara_global_stats" DROP COLUMN "nara_usd_plus_vesting_amount"`)
    }
}
