const avatarIds = [
  "fox",
  "owl",
  "wolf",
  "raven",
  "moth",
  "cobra",
  "stag",
  "hare",
  "panther",
  "shark",
  "bull",
  "gecko",
  "beetle",
  "spider",
  "bat",
  "raccoon",
  "lynx",
  "falcon",
];

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: "app", name: "participants" },
    {
      avatar_id: { type: "text" },
    },
  );

  const values = avatarIds.map((value) => `'${value}'`).join(", ");
  pgm.sql(`
    DO $avatar_backfill$
    DECLARE
      participant_record record;
      candidate_id text;
    BEGIN
      FOR participant_record IN
        SELECT id, room_id, membership_status
        FROM app.participants
        ORDER BY room_id, (membership_status = 'joined') DESC, joined_at, id
      LOOP
        SELECT available.id
        INTO candidate_id
        FROM unnest(ARRAY[${values}]::text[]) WITH ORDINALITY AS available(id, position)
        WHERE NOT EXISTS (
          SELECT 1
          FROM app.participants AS other
          WHERE other.room_id = participant_record.room_id
            AND other.avatar_id = available.id
            AND (
              (
                participant_record.membership_status = 'joined'
                AND other.membership_status = 'joined'
              )
              OR EXISTS (
                SELECT 1
                FROM app.game_participants AS current_game
                INNER JOIN app.game_participants AS other_game
                  ON other_game.game_id = current_game.game_id
                WHERE current_game.participant_id = participant_record.id
                  AND other_game.participant_id = other.id
              )
            )
        )
        ORDER BY available.position
        LIMIT 1;

        IF candidate_id IS NULL THEN
          RAISE EXCEPTION 'Unable to allocate a unique avatar to participant %', participant_record.id;
        END IF;

        UPDATE app.participants
        SET avatar_id = candidate_id
        WHERE id = participant_record.id;
      END LOOP;

      IF EXISTS (
        SELECT 1
        FROM app.participants
        WHERE membership_status = 'joined'
        GROUP BY room_id, avatar_id
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Avatar backfill produced a duplicate joined-room identity';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM app.game_participants AS game_participant
        INNER JOIN app.participants AS participant
          ON participant.id = game_participant.participant_id
        GROUP BY game_participant.game_id, participant.avatar_id
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Avatar backfill produced a duplicate historical game identity';
      END IF;
    END
    $avatar_backfill$;
  `);

  pgm.alterColumn({ schema: "app", name: "participants" }, "avatar_id", { notNull: true });
  pgm.addConstraint(
    { schema: "app", name: "participants" },
    "participants_avatar_id",
    `CHECK (avatar_id IN (${values}))`,
  );
  pgm.createIndex({ schema: "app", name: "participants" }, ["room_id", "avatar_id"], {
    name: "participants_joined_avatar_unique",
    unique: true,
    where: "membership_status = 'joined'",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex({ schema: "app", name: "participants" }, ["room_id", "avatar_id"], {
    name: "participants_joined_avatar_unique",
  });
  pgm.dropConstraint({ schema: "app", name: "participants" }, "participants_avatar_id");
  pgm.dropColumn({ schema: "app", name: "participants" }, "avatar_id");
};
