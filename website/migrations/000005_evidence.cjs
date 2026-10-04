/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: "app", name: "evidence_upload_intents" },
    {
      id: { type: "uuid", primaryKey: true },
      assignment_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "task_assignments" },
        onDelete: "CASCADE",
      },
      participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      object_key: { type: "text", notNull: true, unique: true },
      content_type: { type: "text", notNull: true },
      byte_size: { type: "bigint", notNull: true },
      checksum: { type: "text" },
      status: { type: "text", notNull: true, default: "pending" },
      expires_at: { type: "timestamptz", notNull: true },
      confirmed_at: { type: "timestamptz" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "evidence_upload_intents" },
    "evidence_upload_intents_values",
    "CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp') AND byte_size > 0 AND byte_size <= 5242880 AND status IN ('pending', 'confirmed', 'expired'))",
  );
  pgm.createIndex({ schema: "app", name: "evidence_upload_intents" }, "expires_at", {
    name: "evidence_upload_intents_expiry_idx",
    where: "status = 'pending'",
  });
  pgm.createIndex({ schema: "app", name: "evidence_upload_intents" }, "assignment_id", {
    name: "evidence_upload_intents_assignment_pending_unique",
    unique: true,
    where: "status = 'pending'",
  });

  pgm.createTable(
    { schema: "app", name: "task_submissions" },
    {
      id: { type: "uuid", primaryKey: true },
      assignment_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "task_assignments" },
        onDelete: "CASCADE",
      },
      uploader_participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      object_key: { type: "text", notNull: true, unique: true },
      content_type: { type: "text", notNull: true },
      byte_size: { type: "bigint", notNull: true },
      checksum: { type: "text" },
      processing_status: { type: "text", notNull: true, default: "pending" },
      review_status: { type: "text", notNull: true, default: "valid" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      processed_at: { type: "timestamptz" },
      delete_after: { type: "timestamptz" },
      deleted_at: { type: "timestamptz" },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "task_submissions" },
    "task_submissions_values",
    "CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp') AND byte_size > 0 AND byte_size <= 5242880 AND processing_status IN ('pending', 'accepted', 'rejected', 'deleted') AND review_status IN ('valid', 'flagged', 'invalid'))",
  );
  pgm.createIndex({ schema: "app", name: "task_submissions" }, "assignment_id", {
    name: "task_submissions_current_assignment_unique",
    unique: true,
    where:
      "processing_status IN ('pending', 'accepted') AND review_status <> 'invalid' AND deleted_at IS NULL",
  });
  pgm.createIndex({ schema: "app", name: "task_submissions" }, "delete_after", {
    name: "task_submissions_delete_due_idx",
    where: "deleted_at IS NULL AND delete_after IS NOT NULL",
  });

  pgm.createTable(
    { schema: "app", name: "submission_flags" },
    {
      id: { type: "uuid", primaryKey: true },
      submission_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "task_submissions" },
        onDelete: "CASCADE",
      },
      flagger_participant_id: {
        type: "uuid",
        notNull: true,
        references: { schema: "app", name: "participants" },
        onDelete: "CASCADE",
      },
      reason: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      resolved_at: { type: "timestamptz" },
    },
  );
  pgm.createIndex(
    { schema: "app", name: "submission_flags" },
    ["submission_id", "flagger_participant_id"],
    {
      name: "submission_flags_player_unique",
      unique: true,
    },
  );
  pgm.createIndex({ schema: "app", name: "submission_flags" }, ["submission_id", "resolved_at"], {
    name: "submission_flags_unresolved_idx",
  });

  pgm.createTable(
    { schema: "app", name: "jobs" },
    {
      id: { type: "uuid", primaryKey: true },
      type: { type: "text", notNull: true },
      deduplication_key: { type: "text" },
      payload: { type: "jsonb", notNull: true, default: "{}" },
      status: { type: "text", notNull: true, default: "pending" },
      run_at: { type: "timestamptz", notNull: true },
      attempt_count: { type: "integer", notNull: true, default: 0 },
      max_attempts: { type: "integer", notNull: true, default: 5 },
      locked_by: { type: "text" },
      locked_at: { type: "timestamptz" },
      last_error_code: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    },
  );
  pgm.addConstraint(
    { schema: "app", name: "jobs" },
    "jobs_values",
    "CHECK (type IN ('process_evidence', 'delete_evidence', 'delete_orphan') AND status IN ('pending', 'running', 'succeeded', 'failed', 'dead') AND attempt_count >= 0 AND max_attempts BETWEEN 1 AND 20)",
  );
  pgm.createIndex({ schema: "app", name: "jobs" }, ["status", "run_at"], { name: "jobs_due_idx" });
  pgm.createIndex({ schema: "app", name: "jobs" }, "deduplication_key", {
    name: "jobs_active_dedupe_unique",
    unique: true,
    where: "deduplication_key IS NOT NULL AND status IN ('pending', 'running')",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable({ schema: "app", name: "jobs" });
  pgm.dropTable({ schema: "app", name: "submission_flags" });
  pgm.dropTable({ schema: "app", name: "task_submissions" });
  pgm.dropTable({ schema: "app", name: "evidence_upload_intents" });
};
