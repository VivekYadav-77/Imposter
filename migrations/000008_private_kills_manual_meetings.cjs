/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns(
    { schema: "app", name: "rooms" },
    {
      meetings_per_player: { type: "smallint", notNull: true, default: 2 },
      meeting_duration_seconds: { type: "integer", notNull: true, default: 90 },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_manual_meeting_settings",
    "CHECK (meetings_per_player BETWEEN 0 AND 10 AND meeting_duration_seconds BETWEEN 30 AND 300)",
  );
  pgm.addColumn(
    { schema: "app", name: "games" },
    {
      meeting_available_at: { type: "timestamptz" },
      game_ends_at: { type: "timestamptz" },
    },
  );
  pgm.dropConstraint({ schema: "app", name: "meetings" }, "meetings_values");
  pgm.addConstraint(
    { schema: "app", name: "meetings" },
    "meetings_values",
    "CHECK (sequence_number > 0 AND trigger_type IN ('kill', 'task_deadline', 'user_called') AND phase IN ('discussion', 'review', 'voting', 'resolved') AND ((phase = 'resolved') = (resolved_at IS NOT NULL)))",
  );
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "meetings" }, "meetings_values");
  pgm.addConstraint(
    { schema: "app", name: "meetings" },
    "meetings_values",
    "CHECK (sequence_number > 0 AND trigger_type IN ('kill', 'task_deadline') AND phase IN ('discussion', 'review', 'voting', 'resolved') AND ((phase = 'resolved') = (resolved_at IS NOT NULL)))",
  );
  pgm.dropColumns({ schema: "app", name: "games" }, ["meeting_available_at", "game_ends_at"]);
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_manual_meeting_settings");
  pgm.dropColumns({ schema: "app", name: "rooms" }, [
    "meetings_per_player",
    "meeting_duration_seconds",
  ]);
};
