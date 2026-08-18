/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "admin_users" },
    {
      id: { type: "uuid", primaryKey: true },
      email: { type: "text", notNull: true },
      password_hash: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "active" },
      last_login_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "admin_users" },
    "admin_users_email_normalized",
    "CHECK (email = lower(btrim(email)))",
  );
  pgm.addConstraint(
    { schema: "app", name: "admin_users" },
    "admin_users_status",
    "CHECK (status IN ('active', 'disabled'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "admin_users" },
    "admin_users_email_unique",
    "UNIQUE (email)",
  );

  pgm.createTable(
    { schema: "app", name: "admin_sessions" },
    {
      id: { type: "uuid", primaryKey: true },
      admin_user_id: {
        type: "uuid",
        notNull: true,
        references: "app.admin_users",
        onDelete: "CASCADE",
      },
      token_hash: { type: "text", notNull: true, unique: true },
      issued_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
      last_used_at: { type: "timestamptz" },
      revoked_at: { type: "timestamptz" },
      created_ip_hash: { type: "text" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "admin_sessions" },
    "admin_sessions_expiry",
    "CHECK (expires_at > issued_at)",
  );
  pgm.createIndex({ schema: "app", name: "admin_sessions" }, "token_hash", {
    name: "admin_sessions_token_hash_idx",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "admin_sessions" }, "expires_at", {
    name: "admin_sessions_expires_at_idx",
  });

  pgm.createTable(
    { schema: "app", name: "task_packs" },
    {
      id: { type: "uuid", primaryKey: true },
      created_by_admin_id: {
        type: "uuid",
        notNull: true,
        references: "app.admin_users",
        onDelete: "RESTRICT",
      },
      slug: { type: "text", notNull: true, unique: true },
      name: { type: "text", notNull: true },
      description: { type: "text" },
      status: { type: "text", notNull: true, default: "draft" },
      revision: { type: "integer", notNull: true, default: 1 },
      published_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "task_packs" },
    "task_packs_name_length",
    "CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_packs" },
    "task_packs_description_length",
    "CHECK (description IS NULL OR char_length(description) <= 1000)",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_packs" },
    "task_packs_status",
    "CHECK (status IN ('draft', 'published', 'archived'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_packs" },
    "task_packs_revision",
    "CHECK (revision > 0)",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_packs" },
    "task_packs_publication",
    "CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')",
  );
  pgm.createIndex({ schema: "app", name: "task_packs" }, ["status", "name"], {
    name: "task_packs_status_name_idx",
  });

  pgm.createTable(
    { schema: "app", name: "task_pack_items" },
    {
      id: { type: "uuid", primaryKey: true },
      task_pack_id: {
        type: "uuid",
        notNull: true,
        references: "app.task_packs",
        onDelete: "CASCADE",
      },
      position: { type: "integer", notNull: true },
      description: { type: "text", notNull: true },
      is_active: { type: "boolean", notNull: true, default: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "task_pack_items" },
    "task_pack_items_position",
    "CHECK (position > 0)",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_pack_items" },
    "task_pack_items_description",
    "CHECK (char_length(btrim(description)) BETWEEN 1 AND 280)",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_pack_items" },
    "task_pack_items_pack_position",
    "UNIQUE (task_pack_id, position)",
  );

  pgm.createTable(
    { schema: "app", name: "admin_audit_events" },
    {
      id: { type: "uuid", primaryKey: true },
      admin_user_id: { type: "uuid", references: "app.admin_users", onDelete: "SET NULL" },
      action: { type: "text", notNull: true },
      target_type: { type: "text" },
      target_id: { type: "uuid" },
      request_id: { type: "text" },
      ip_hash: { type: "text" },
      outcome: { type: "text", notNull: true },
      metadata: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "admin_audit_events" },
    "admin_audit_events_outcome",
    "CHECK (outcome IN ('success', 'failure'))",
  );
  pgm.createIndex({ schema: "app", name: "admin_audit_events" }, ["admin_user_id", "created_at"], {
    name: "admin_audit_admin_time_idx",
  });

  pgm.createTable(
    { schema: "app", name: "admin_idempotency_records" },
    {
      admin_user_id: {
        type: "uuid",
        notNull: true,
        references: "app.admin_users",
        onDelete: "CASCADE",
      },
      key: { type: "text", notNull: true },
      operation: { type: "text", notNull: true },
      request_hash: { type: "text", notNull: true },
      response_body: { type: "jsonb", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
    },
    { constraints: { primaryKey: ["admin_user_id", "key"] } },
  );
  pgm.createIndex({ schema: "app", name: "admin_idempotency_records" }, "expires_at", {
    name: "admin_idempotency_expires_at_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "admin_idempotency_records" });
  pgm.dropTable({ schema: "app", name: "admin_audit_events" });
  pgm.dropTable({ schema: "app", name: "task_pack_items" });
  pgm.dropTable({ schema: "app", name: "task_packs" });
  pgm.dropTable({ schema: "app", name: "admin_sessions" });
  pgm.dropTable({ schema: "app", name: "admin_users" });
};
