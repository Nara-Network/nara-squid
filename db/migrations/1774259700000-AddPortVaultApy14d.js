module.exports = class AddPortVaultApy14d1774259700000 {
    name = 'AddPortVaultApy14d1774259700000'

    async up(db) {
        await db.query(`ALTER TABLE "port_vault_apy_chart" ADD "apy14d" numeric NOT NULL DEFAULT 0`)
        await db.query(`ALTER TABLE "port_vault_apy_chart" ADD "exchange_rate14d_ago" numeric NOT NULL DEFAULT 0`)
        await db.query(`ALTER TABLE "port_vault_apy_chart" ALTER COLUMN "apy14d" DROP DEFAULT`)
        await db.query(`ALTER TABLE "port_vault_apy_chart" ALTER COLUMN "exchange_rate14d_ago" DROP DEFAULT`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "port_vault_apy_chart" DROP COLUMN "exchange_rate14d_ago"`)
        await db.query(`ALTER TABLE "port_vault_apy_chart" DROP COLUMN "apy14d"`)
    }
}
