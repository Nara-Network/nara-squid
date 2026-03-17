module.exports = class AddNaraGlobalStats1773836400000 {
    name = 'AddNaraGlobalStats1773836400000'

    async up(db) {
        await db.query(`CREATE TABLE "nara_global_stats" ("id" character varying NOT NULL, "network" character varying(16) NOT NULL, "nara_usd_supply" numeric NOT NULL, "nara_usd_supply_formatted" numeric NOT NULL, "nara_usd_decimals" integer NOT NULL, "percentage_staked" numeric NOT NULL, "updated_at" numeric NOT NULL, CONSTRAINT "PK_47ab4c6b0bc8a2cd2c5260c4d8c" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_e7bd8191a3fd6bf56a3f7f8666" ON "nara_global_stats" ("network") `)
    }

    async down(db) {
        await db.query(`DROP INDEX "public"."IDX_e7bd8191a3fd6bf56a3f7f8666"`)
        await db.query(`DROP TABLE "nara_global_stats"`)
    }
}
