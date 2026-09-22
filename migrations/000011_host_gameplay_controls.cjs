/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_timer_ranges");
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_timer_ranges",
    "CHECK (task_phase_seconds BETWEEN 300 AND 14400 AND discussion_seconds BETWEEN 30 AND 300 AND review_seconds BETWEEN 30 AND 180 AND voting_seconds BETWEEN 30 AND 180)",
  );
  pgm.addColumns(
    { schema: "app", name: "rooms" },
    {
      evidence_visibility: { type: "text", notNull: true, default: "public" },
      meeting_task_requirement: { type: "text", notNull: true, default: "one" },
      meeting_cooldown_seconds: { type: "integer", notNull: true, default: 90 },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_host_gameplay_controls",
    "CHECK (evidence_visibility IN ('private', 'public') AND meeting_task_requirement IN ('none', 'one') AND meeting_cooldown_seconds BETWEEN 10 AND 1800)",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_host_gameplay_controls");
  pgm.dropColumns({ schema: "app", name: "rooms" }, [
    "evidence_visibility",
    "meeting_task_requirement",
    "meeting_cooldown_seconds",
  ]);
  pgm.sql("UPDATE app.rooms SET task_phase_seconds = 3600 WHERE task_phase_seconds > 3600");
  pgm.dropConstraint({ schema: "app", name: "rooms" }, "rooms_timer_ranges");
  pgm.addConstraint(
    { schema: "app", name: "rooms" },
    "rooms_timer_ranges",
    "CHECK (task_phase_seconds BETWEEN 300 AND 3600 AND discussion_seconds BETWEEN 30 AND 300 AND review_seconds BETWEEN 30 AND 180 AND voting_seconds BETWEEN 30 AND 180)",
  );
};
