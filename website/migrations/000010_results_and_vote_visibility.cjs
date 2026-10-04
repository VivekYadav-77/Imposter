/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: "app", name: "rooms" },
    {
      vote_visibility: { type: "text", notNull: true, default: "private" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_vote_visibility",
    "CHECK (vote_visibility IN ('private', 'public'))",
  );
  pgm.addColumn(
    { schema: "app", name: "games" },
    {
      end_reason: { type: "text" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "games" },
    "games_end_reason",
    "CHECK (end_reason IS NULL OR end_reason IN ('tasks_completed', 'imposters_ejected', 'imposter_parity', 'time_expired', 'abandoned'))",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "games" }, "games_end_reason");
  pgm.dropColumn({ schema: "app", name: "games" }, "end_reason");
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_vote_visibility");
  pgm.dropColumn({ schema: "app", name: "rooms" }, "vote_visibility");
};
