/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "rooms" },
    {
      id: { type: "uuid", primaryKey: true },
      code: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "lobby" },
      host_participant_id: { type: "uuid" },
      selected_task_pack_id: { type: "uuid", references: "app.task_packs", onDelete: "RESTRICT" },
      max_players: { type: "smallint", notNull: true, default: 12 },
      imposter_count: { type: "smallint", notNull: true, default: 1 },
      tasks_per_crew: { type: "smallint", notNull: true, default: 3 },
      task_phase_seconds: { type: "integer", notNull: true, default: 900 },
      discussion_seconds: { type: "integer", notNull: true, default: 90 },
      review_seconds: { type: "integer", notNull: true, default: 60 },
      voting_seconds: { type: "integer", notNull: true, default: 60 },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      last_activity_at: {
        type: "timestamptz",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
      expires_at: { type: "timestamptz", notNull: true },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_code",
    "CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$')",
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_status",
    "CHECK (status IN ('lobby', 'active', 'completed', 'abandoned', 'expired'))",
  );
  pgm.addConstraint({ schema: "app", name: "rooms" }, "rooms_capacity", "CHECK (max_players = 12)");
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_timer_ranges",
    "CHECK (task_phase_seconds BETWEEN 300 AND 3600 AND discussion_seconds BETWEEN 30 AND 300 AND review_seconds BETWEEN 30 AND 180 AND voting_seconds BETWEEN 30 AND 180)",
  );
  pgm.createIndex({ schema: "app", name: "rooms" }, "code", {
    name: "rooms_active_code_unique",
    unique: true,
    where: "status IN ('lobby', 'active')",
  });
  pgm.createIndex({ schema: "app", name: "rooms" }, "expires_at", {
    name: "rooms_expires_at_idx",
    where: "status IN ('lobby', 'active')",
  });

  pgm.createTable(
    { schema: "app", name: "participants" },
    {
      id: { type: "uuid", primaryKey: true },
      room_id: { type: "uuid", notNull: true, references: "app.rooms", onDelete: "CASCADE" },
      nickname: { type: "text", notNull: true },
      normalized_nickname: { type: "text", notNull: true },
      membership_status: { type: "text", notNull: true, default: "joined" },
      joined_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      last_seen_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      disconnected_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "participants" },
    "participants_nickname_length",
    "CHECK (char_length(nickname) BETWEEN 1 AND 24)",
  );
  pgm.addConstraint(
    { schema: "app", name: "participants" },
    "participants_membership_status",
    "CHECK (membership_status IN ('joined', 'left', 'removed'))",
  );
  pgm.createIndex({ schema: "app", name: "participants" }, ["room_id", "normalized_nickname"], {
    name: "participants_joined_nickname_unique",
    unique: true,
    where: "membership_status = 'joined'",
  });
  pgm.createIndex({ schema: "app", name: "participants" }, ["room_id", "joined_at", "id"], {
    name: "participants_host_transfer_idx",
    where: "membership_status = 'joined'",
  });
  pgm.addConstraint({ schema: "app", name: "rooms" }, "rooms_host_participant_fk", {
    foreignKeys: {
      columns: "host_participant_id",
      references: "app.participants(id)",
      onDelete: "SET NULL",
    },
    deferrable: true,
    deferred: true,
  });

  pgm.createTable(
    { schema: "app", name: "participant_sessions" },
    {
      id: { type: "uuid", primaryKey: true },
      participant_id: {
        type: "uuid",
        notNull: true,
        references: "app.participants",
        onDelete: "CASCADE",
      },
      token_hash: { type: "text", notNull: true, unique: true },
      issued_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
      last_used_at: { type: "timestamptz" },
      revoked_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "participant_sessions" },
    "participant_sessions_expiry",
    "CHECK (expires_at > issued_at)",
  );
  pgm.createIndex({ schema: "app", name: "participant_sessions" }, "token_hash", {
    name: "participant_sessions_token_hash_idx",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "participant_sessions" }, "expires_at", {
    name: "participant_sessions_expires_at_idx",
    where: "revoked_at IS NULL",
  });

  pgm.createTable(
    { schema: "app", name: "room_idempotency_records" },
    {
      scope: { type: "text", notNull: true },
      key: { type: "text", notNull: true },
      operation: { type: "text", notNull: true },
      request_hash: { type: "text", notNull: true },
      response_body: { type: "jsonb", notNull: true },
      session_id: { type: "uuid" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
    },
    { constraints: { primaryKey: ["scope", "key"] } },
  );
  pgm.createIndex({ schema: "app", name: "room_idempotency_records" }, "expires_at", {
    name: "room_idempotency_expires_at_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "room_idempotency_records" });
  pgm.dropTable({ schema: "app", name: "participant_sessions" });
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_host_participant_fk");
  pgm.dropTable({ schema: "app", name: "participants" });
  pgm.dropTable({ schema: "app", name: "rooms" });
};
