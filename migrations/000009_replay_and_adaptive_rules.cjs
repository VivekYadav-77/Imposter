/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "games" }, "games_room_id_key");
  pgm.createIndex({ schema: "app", name: "games" }, ["room_id", "started_at"], {
    name: "games_room_history_idx",
  });
  pgm.addColumns(
    { schema: "app", name: "rooms" },
    {
      meeting_voting_mode: { type: "text", notNull: true, default: "timed" },
      imposter_cooldown_seconds: { type: "integer", notNull: true, default: 60 },
    },
  );
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_manual_meeting_settings");
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_manual_meeting_settings",
    "CHECK (meetings_per_player BETWEEN 0 AND 10 AND meeting_duration_seconds BETWEEN 30 AND 1800)",
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_adaptive_rules",
    "CHECK (meeting_voting_mode IN ('timed', 'all_voted') AND imposter_cooldown_seconds BETWEEN 10 AND 300)",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_manual_meeting_settings");
  pgm.sql(
    "UPDATE app.rooms SET meeting_duration_seconds = 300 WHERE meeting_duration_seconds > 300",
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_manual_meeting_settings",
    "CHECK (meetings_per_player BETWEEN 0 AND 10 AND meeting_duration_seconds BETWEEN 30 AND 300)",
  );
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_adaptive_rules");
  pgm.dropColumns({ schema: "app", name: "rooms" }, [
    "meeting_voting_mode",
    "imposter_cooldown_seconds",
  ]);
  pgm.dropIndex({ schema: "app", name: "games" }, ["room_id", "started_at"], {
    name: "games_room_history_idx",
  });
  pgm.sql(`
    DELETE FROM app.games older
    USING app.games newer
    WHERE older.room_id = newer.room_id
      AND (older.started_at, older.id) < (newer.started_at, newer.id)
  `);
  pgm.addConstraint({ schema: "app", name: "games" }, "games_room_id_key", {
    unique: "room_id",
  });
};
