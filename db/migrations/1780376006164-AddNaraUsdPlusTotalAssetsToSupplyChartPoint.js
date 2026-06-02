module.exports = class AddNaraUsdPlusTotalAssetsToSupplyChartPoint1780376006164 {
    name = 'AddNaraUsdPlusTotalAssetsToSupplyChartPoint1780376006164'

    async up(db) {
        await db.query(`ALTER TABLE "nara_supply_chart_point" ADD "nara_usd_plus_total_assets" numeric`)
        await db.query(`ALTER TABLE "nara_supply_chart_point" ADD "nara_usd_plus_total_assets_formatted" numeric`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "nara_supply_chart_point" DROP COLUMN "nara_usd_plus_total_assets_formatted"`)
        await db.query(`ALTER TABLE "nara_supply_chart_point" DROP COLUMN "nara_usd_plus_total_assets"`)
    }
}
