/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "admin_oauth_transactions" },
    {
      state_hash: { type: "text", primaryKey: true },
      nonce: { type: "text", notNull: true },
      expires_at: { type: "timestamptz", notNull: true },
      consumed_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.createIndex({ schema: "app", name: "admin_oauth_transactions" }, ["expires_at"], {
    name: "admin_oauth_transactions_expiry_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "admin_oauth_transactions" });
};
