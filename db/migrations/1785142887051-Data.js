module.exports = class Data1785142887051 {
    name = 'Data1785142887051'

    async up(db) {
        await db.query(`ALTER TABLE "port_vault" ADD "apy_between_updates" numeric NOT NULL DEFAULT 0`)
        await db.query(`ALTER TABLE "port_vault" ALTER COLUMN "apy_between_updates" DROP DEFAULT`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "port_vault" DROP COLUMN "apy_between_updates"`)
    }
}
