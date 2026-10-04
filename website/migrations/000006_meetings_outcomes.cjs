/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "meetings" },
    {
      id: { type: "uuid", primaryKey: true },
      game_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "games" },
        onDelete: "CASCADE",
      },
      sequence_number: { type: "integer", notNull: true },
      trigger_type: { type: "text", notNull: true },
      trigger_actor_participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      reported_participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      phase: { type: "text", notNull: true },
      deadline_at: { type: "timestamptz" },
      ejected_participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      resolved_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "meetings" },
    "meetings_values",
    "CHECK (sequence_number > 0 AND trigger_type IN ('kill', 'task_deadline') AND phase IN ('discussion', 'review', 'voting', 'resolved') AND ((phase = 'resolved') = (resolved_at IS NOT NULL)))",
  );
  pgm.createIndex({ schema: "app", name: "meetings" }, ["game_id", "sequence_number"], {
    name: "meetings_sequence_unique",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "meetings" }, "game_id", {
    name: "meetings_one_unresolved",
    unique: true,
    where: "resolved_at IS NULL",
  });
  pgm.createIndex({ schema: "app", name: "meetings" }, "deadline_at", {
    name: "meetings_due_idx",
    where: "resolved_at IS NULL AND deadline_at IS NOT NULL",
  });

  pgm.createTable(
    { schema: "app", name: "meeting_eligible_voters" },
    {
      meeting_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "meetings" },
        onDelete: "CASCADE",
      },
      participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
    },
    { constraints: { primaryKey: ["meeting_id", "participant_id"] } },
  );

  pgm.createTable(
    { schema: "app", name: "evidence_review_items" },
    {
      id: { type: "uuid", primaryKey: true },
      meeting_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "meetings" },
        onDelete: "CASCADE",
      },
      submission_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "task_submissions" },
        onDelete: "RESTRICT",
      },
      position: { type: "integer", notNull: true },
      resolution: { type: "text" },
      resolved_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "evidence_review_items" },
    "evidence_review_items_values",
    "CHECK (position > 0 AND (resolution IS NULL OR resolution IN ('valid', 'invalid')) AND ((resolution IS NULL) = (resolved_at IS NULL)))",
  );
  pgm.createIndex(
    { schema: "app", name: "evidence_review_items" },
    ["meeting_id", "submission_id"],
    { name: "evidence_review_items_submission_unique", unique: true },
  );
  pgm.createIndex({ schema: "app", name: "evidence_review_items" }, ["meeting_id", "position"], {
    name: "evidence_review_items_position_unique",
    unique: true,
  });
  pgm.createIndex({ schema: "app", name: "evidence_review_items" }, "submission_id", {
    name: "evidence_review_items_once_unique",
    unique: true,
  });

  pgm.createTable(
    { schema: "app", name: "evidence_review_votes" },
    {
      id: { type: "uuid", primaryKey: true },
      review_item_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "evidence_review_items" },
        onDelete: "CASCADE",
      },
      voter_participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      decision: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "evidence_review_votes" },
    "evidence_review_votes_decision",
    "CHECK (decision IN ('valid', 'invalid'))",
  );
  pgm.createIndex(
    { schema: "app", name: "evidence_review_votes" },
    ["review_item_id", "voter_participant_id"],
    { name: "evidence_review_votes_voter_unique", unique: true },
  );

  pgm.createTable(
    { schema: "app", name: "ejection_votes" },
    {
      id: { type: "uuid", primaryKey: true },
      meeting_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "meetings" },
        onDelete: "CASCADE",
      },
      voter_participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      target_participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.createIndex(
    { schema: "app", name: "ejection_votes" },
    ["meeting_id", "voter_participant_id"],
    {
      name: "ejection_votes_voter_unique",
      unique: true,
    },
  );

  pgm.createTable(
    { schema: "app", name: "eliminations" },
    {
      id: { type: "uuid", primaryKey: true },
      game_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "games" },
        onDelete: "CASCADE",
      },
      meeting_id: {
        type: "uuid",
        references: { schema: "app", name: "meetings" },
        onDelete: "SET NULL",
      },
      target_participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      actor_participant_id: {
        type: "uuid",
        references: { schema: "app", name: "participants" },
        onDelete: "SET NULL",
      },
      type: { type: "text", notNull: true },
      occurred_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "eliminations" },
    "eliminations_type",
    "CHECK (type IN ('killed', 'ejected'))",
  );
  pgm.createIndex({ schema: "app", name: "eliminations" }, ["game_id", "target_participant_id"], {
    name: "eliminations_target_unique",
    unique: true,
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "eliminations" });
  pgm.dropTable({ schema: "app", name: "ejection_votes" });
  pgm.dropTable({ schema: "app", name: "evidence_review_votes" });
  pgm.dropTable({ schema: "app", name: "evidence_review_items" });
  pgm.dropTable({ schema: "app", name: "meeting_eligible_voters" });
  pgm.dropTable({ schema: "app", name: "meetings" });
};
