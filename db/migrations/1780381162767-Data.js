module.exports = class Data1780381162767 {
    name = 'Data1780381162767'

    async up(db) {
        // Reward-timing inputs for the app APR annualizer (seconds). NOT NULL with
        // a 0 default so existing nara_global_stats rows stay valid; the processor
        // overwrites them on the next head update.
        await db.query(`ALTER TABLE "nara_global_stats" ADD "nara_usd_plus_last_distribution_at" numeric NOT NULL DEFAULT 0`)
        await db.query(`ALTER TABLE "nara_global_stats" ADD "nara_usd_plus_vesting_period" numeric NOT NULL DEFAULT 0`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "nara_global_stats" DROP COLUMN "nara_usd_plus_vesting_period"`)
        await db.query(`ALTER TABLE "nara_global_stats" DROP COLUMN "nara_usd_plus_last_distribution_at"`)
    }
}
