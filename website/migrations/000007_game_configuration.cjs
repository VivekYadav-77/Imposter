/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: "app", name: "task_pack_items" },
    {
      difficulty: { type: "text", notNull: true, default: "medium" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "task_pack_items" },
    "task_pack_items_difficulty",
    "CHECK (difficulty IN ('easy', 'medium', 'hard'))",
  );
  pgm.addColumn(
    { schema: "app", name: "task_packs" },
    {
      roles: { type: "jsonb", notNull: true, default: pgm.func("'[]'::jsonb") },
    },
  );
  pgm.addColumn(
    { schema: "app", name: "rooms" },
    {
      min_players: { type: "smallint", notNull: true, default: 3 },
      easy_tasks_per_player: { type: "smallint", notNull: true, default: 0 },
      medium_tasks_per_player: { type: "smallint", notNull: true, default: 3 },
      hard_tasks_per_player: { type: "smallint", notNull: true, default: 0 },
      role_counts: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
    },
  );
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_capacity");
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_capacity",
    "CHECK (min_players BETWEEN 3 AND max_players AND max_players BETWEEN 3 AND 15)",
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_game_configuration",
    "CHECK (imposter_count BETWEEN 1 AND 7 AND easy_tasks_per_player BETWEEN 0 AND 15 AND medium_tasks_per_player BETWEEN 0 AND 15 AND hard_tasks_per_player BETWEEN 0 AND 15 AND easy_tasks_per_player + medium_tasks_per_player + hard_tasks_per_player BETWEEN 1 AND 15)",
  );
  pgm.addColumn(
    { schema: "app", name: "game_participants" },
    {
      crew_role_name: { type: "text" },
      crew_role_specialization: { type: "text" },
      crew_role_ability: { type: "text" },
    },
  );
  pgm.addColumn(
    { schema: "app", name: "game_tasks" },
    {
      difficulty_snapshot: { type: "text", notNull: true, default: "medium" },
    },
  );
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumn({ schema: "app", name: "game_tasks" }, "difficulty_snapshot");
  pgm.dropColumns({ schema: "app", name: "game_participants" }, [
    "crew_role_name",
    "crew_role_specialization",
    "crew_role_ability",
  ]);
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_game_configuration");
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_capacity");
  pgm.addConstraint({ schema: "app", name: "rooms" }, "rooms_capacity", "CHECK (max_players = 12)");
  pgm.dropColumns({ schema: "app", name: "rooms" }, [
    "min_players",
    "easy_tasks_per_player",
    "medium_tasks_per_player",
    "hard_tasks_per_player",
    "role_counts",
  ]);
  pgm.dropColumn({ schema: "app", name: "task_packs" }, "roles");
  pgm.dropConstraint({ schema: "app", name: "task_pack_items" }, "task_pack_items_difficulty");
  pgm.dropColumn({ schema: "app", name: "task_pack_items" }, "difficulty");
};
