/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "games" },
    {
      id: { type: "uuid", primaryKey: true },
      room_id: {
        type: "uuid",
        notNull: true,
        unique: true,
        references: "app.rooms",
        onDelete: "CASCADE",
      },
      source_task_pack_id: {
        type: "uuid",
        notNull: true,
        references: "app.task_packs",
        onDelete: "RESTRICT",
      },
      task_pack_name_snapshot: { type: "text", notNull: true },
      phase: { type: "text", notNull: true },
      state_version: { type: "bigint", notNull: true, default: 1 },
      winner: { type: "text" },
      phase_started_at: { type: "timestamptz", notNull: true },
      phase_deadline_at: { type: "timestamptz" },
      started_at: { type: "timestamptz", notNull: true },
      ended_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "games" },
    "games_phase",
    "CHECK (phase IN ('task', 'discussion', 'review', 'voting', 'result', 'game_over', 'abandoned'))",
  );
  pgm.addConstraint({ schema: "app", name: "games" }, "games_version", "CHECK (state_version > 0)");
  pgm.addConstraint(
    { schema: "app", name: "games" },
    "games_winner",
    "CHECK (winner IS NULL OR winner IN ('crew', 'imposters'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "games" },
    "games_terminal",
    "CHECK ((phase IN ('game_over', 'abandoned')) = (ended_at IS NOT NULL))",
  );
  pgm.createIndex({ schema: "app", name: "games" }, "phase_deadline_at", {
    name: "games_due_idx",
    where: "phase_deadline_at IS NOT NULL AND phase NOT IN ('game_over', 'abandoned')",
  });

  pgm.createTable(
    { schema: "app", name: "game_participants" },
    {
      game_id: { type: "uuid", notNull: true, references: "app.games", onDelete: "CASCADE" },
      participant_id: {
        type: "uuid",
        notNull: true,
        references: "app.participants",
        onDelete: "CASCADE",
      },
      role: { type: "text", notNull: true },
      life_status: { type: "text", notNull: true, default: "alive" },
      kill_available_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
    { constraints: { primaryKey: ["game_id", "participant_id"] } },
  );
  pgm.addConstraint(
    { schema: "app", name: "game_participants" },
    "game_participants_role",
    "CHECK (role IN ('crew', 'imposter'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "game_participants" },
    "game_participants_life",
    "CHECK (life_status IN ('alive', 'killed', 'ejected'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "game_participants" },
    "game_participants_kill",
    "CHECK ((role = 'imposter') OR kill_available_at IS NULL)",
  );
  pgm.createIndex(
    { schema: "app", name: "game_participants" },
    ["game_id", "role", "life_status"],
    { name: "game_participants_win_idx" },
  );

  pgm.createTable(
    { schema: "app", name: "game_tasks" },
    {
      id: { type: "uuid", primaryKey: true },
      game_id: { type: "uuid", notNull: true, references: "app.games", onDelete: "CASCADE" },
      source_pack_item_id: {
        type: "uuid",
        references: "app.task_pack_items",
        onDelete: "SET NULL",
      },
      description_snapshot: { type: "text", notNull: true },
      position: { type: "integer", notNull: true },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "game_tasks" },
    "game_tasks_position_positive",
    "CHECK (position > 0)",
  );
  pgm.createIndex({ schema: "app", name: "game_tasks" }, ["game_id", "position"], {
    name: "game_tasks_position_unique",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "game_tasks" }, ["game_id", "id"], {
    name: "game_tasks_game_id_id_unique",
    unique: true,
  });

  pgm.createTable(
    { schema: "app", name: "task_assignments" },
    {
      id: { type: "uuid", primaryKey: true },
      game_id: { type: "uuid", notNull: true, references: "app.games", onDelete: "CASCADE" },
      game_task_id: {
        type: "uuid",
        notNull: true,
        references: "app.game_tasks",
        onDelete: "CASCADE",
      },
      participant_id: {
        type: "uuid",
        notNull: true,
        references: "app.participants",
        onDelete: "CASCADE",
      },
      counts_toward_progress: { type: "boolean", notNull: true },
      status: { type: "text", notNull: true, default: "assigned" },
      completed_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "task_assignments" },
    "task_assignments_status",
    "CHECK (status IN ('assigned', 'completed'))",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_assignments" },
    "task_assignments_completion",
    "CHECK ((status = 'completed') = (completed_at IS NOT NULL))",
  );
  pgm.addConstraint(
    { schema: "app", name: "task_assignments" },
    "task_assignments_game_participant_fk",
    {
      foreignKeys: {
        columns: ["game_id", "participant_id"],
        references: "app.game_participants(game_id, participant_id)",
        onDelete: "CASCADE",
      },
    },
  );
  pgm.addConstraint({ schema: "app", name: "task_assignments" }, "task_assignments_game_task_fk", {
    foreignKeys: {
      columns: ["game_id", "game_task_id"],
      references: "app.game_tasks(game_id, id)",
      onDelete: "CASCADE",
    },
  });
  pgm.createIndex({ schema: "app", name: "task_assignments" }, ["game_task_id", "participant_id"], {
    name: "task_assignments_task_player_unique",
    unique: true,
  });
  pgm.createIndex(
    { schema: "app", name: "task_assignments" },
    ["game_id", "counts_toward_progress", "status"],
    { name: "task_assignments_progress_idx" },
  );

  pgm.createTable(
    { schema: "app", name: "game_events" },
    {
      id: { type: "bigserial", primaryKey: true },
      game_id: { type: "uuid", notNull: true, references: "app.games", onDelete: "CASCADE" },
      state_version: { type: "bigint", notNull: true },
      type: { type: "text", notNull: true },
      actor_participant_id: { type: "uuid", references: "app.participants", onDelete: "SET NULL" },
      visibility: { type: "text", notNull: true },
      payload: { type: "jsonb", notNull: true, default: "{}" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "game_events" },
    "game_events_visibility",
    "CHECK (visibility IN ('internal', 'public', 'actor'))",
  );
  pgm.createIndex({ schema: "app", name: "game_events" }, ["game_id", "state_version"], {
    name: "game_events_version_unique",
    unique: true,
  });

  pgm.createTable(
    { schema: "app", name: "game_idempotency_records" },
    {
      participant_id: {
        type: "uuid",
        notNull: true,
        references: "app.participants",
        onDelete: "CASCADE",
      },
      key: { type: "text", notNull: true },
      operation: { type: "text", notNull: true },
      request_hash: { type: "text", notNull: true },
      response_body: { type: "jsonb", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      expires_at: { type: "timestamptz", notNull: true },
    },
    { constraints: { primaryKey: ["participant_id", "key"] } },
  );
  pgm.createIndex({ schema: "app", name: "game_idempotency_records" }, "expires_at", {
    name: "game_idempotency_expires_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "game_idempotency_records" });
  pgm.dropTable({ schema: "app", name: "game_events" });
  pgm.dropTable({ schema: "app", name: "task_assignments" });
  pgm.dropTable({ schema: "app", name: "game_tasks" });
  pgm.dropTable({ schema: "app", name: "game_participants" });
  pgm.dropTable({ schema: "app", name: "games" });
};
