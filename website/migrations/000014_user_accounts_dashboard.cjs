/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "user_accounts" },
    {
      id: { type: "uuid", primaryKey: true },
      email: { type: "text", notNull: true, unique: true },
      display_name: { type: "text", notNull: true },
      default_avatar_id: { type: "text", notNull: true },
      password_hash: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "active" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "user_accounts" },
    "user_accounts_status",
    "CHECK (status IN ('active', 'disabled'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "user_accounts" },
    "user_accounts_display_name",
    "CHECK (char_length(display_name) BETWEEN 1 AND 24)",
  );

  pgm.createTable(
    { schema: "app", name: "user_sessions" },
    {
      id: { type: "uuid", primaryKey: true },
      user_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "user_accounts" },
        onDelete: "CASCADE",
      },
      token_hash: { type: "text", notNull: true, unique: true },
      device_label: { type: "text", notNull: true },
      ip_hash: { type: "text", notNull: true },
      issued_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
      last_used_at: { type: "timestamptz" },
      revoked_at: { type: "timestamptz" },
    },
  );
  pgm.createIndex({ schema: "app", name: "user_sessions" }, ["user_id", "expires_at"], {
    name: "user_sessions_user_expiry_idx",
  });

  pgm.addColumn(
    { schema: "app", name: "participants" },
    {
      user_id: {
        type: "uuid",
        references: { schema: "app", name: "user_accounts" },
        onDelete: "SET NULL",
      },
    },
  );
  pgm.createIndex({ schema: "app", name: "participants" }, ["room_id", "user_id"], {
    name: "participants_joined_user_unique",
    unique: true,
    where: "user_id IS NOT NULL AND membership_status = 'joined'",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex({ schema: "app", name: "participants" }, ["room_id", "user_id"], {
    name: "participants_joined_user_unique",
  });
  pgm.dropColumn({ schema: "app", name: "participants" }, "user_id");
  pgm.dropTable({ schema: "app", name: "user_sessions" });
  pgm.dropTable({ schema: "app", name: "user_accounts" });
};
