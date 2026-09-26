/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.alterColumn({ schema: "app", name: "user_accounts" }, "password_hash", { notNull: false });

  pgm.createTable(
    { schema: "app", name: "user_identities" },
    {
      id: { type: "uuid", primaryKey: true },
      user_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "user_accounts" },
        onDelete: "CASCADE",
      },
      provider: { type: "text", notNull: true },
      provider_subject: { type: "text", notNull: true },
      email: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "user_identities" },
    "user_identities_provider",
    "CHECK (provider = 'google')",
  );
  pgm.createIndex({ schema: "app", name: "user_identities" }, ["provider", "provider_subject"], {
    name: "user_identities_provider_subject_unique",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "user_identities" }, ["provider", "user_id"], {
    name: "user_identities_provider_user_unique",
    unique: true,
  });

  pgm.addColumn(
    { schema: "app", name: "user_sessions" },
    { reauthenticated_at: { type: "timestamptz" } },
  );

  pgm.createTable(
    { schema: "app", name: "oauth_transactions" },
    {
      state_hash: { type: "text", primaryKey: true },
      nonce: { type: "text", notNull: true },
      intent: { type: "text", notNull: true },
      participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      current_user_id: {
        type: "uuid",
        references: { schema: "app", name: "user_accounts" },
        onDelete: "SET NULL",
      },
      current_session_id: {
        type: "uuid",
        references: { schema: "app", name: "user_sessions" },
        onDelete: "SET NULL",
      },
      return_to: { type: "text", notNull: true },
      expires_at: { type: "timestamptz", notNull: true },
      consumed_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "oauth_transactions" },
    "oauth_transactions_intent",
    "CHECK (intent IN ('login', 'play', 'post_game', 'delete'))",
  );
  pgm.createIndex({ schema: "app", name: "oauth_transactions" }, ["expires_at"], {
    name: "oauth_transactions_expiry_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "oauth_transactions" });
  pgm.dropColumn({ schema: "app", name: "user_sessions" }, "reauthenticated_at");
  pgm.dropTable({ schema: "app", name: "user_identities" });
  pgm.sql(
    "UPDATE app.user_accounts SET password_hash = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' WHERE password_hash IS NULL",
  );
  pgm.alterColumn({ schema: "app", name: "user_accounts" }, "password_hash", { notNull: true });
};
