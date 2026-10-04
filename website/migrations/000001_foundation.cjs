/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createSchema("app", { ifNotExists: true });
  pgm.sql("COMMENT ON SCHEMA app IS 'Application-owned objects; feature tables begin in Phase 2'");
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropSchema("app", { ifExists: true });
};
