/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: "app", name: "oauth_transactions" },
    { channel: { type: "text", notNull: true, default: "web" } },
  );
  pgm.addConstraint(
    { schema: "app", name: "oauth_transactions" },
    "oauth_transactions_channel",
    "CHECK (channel IN ('web', 'android'))",
  );
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropConstraint({ schema: "app", name: "oauth_transactions" }, "oauth_transactions_channel");
  pgm.dropColumn({ schema: "app", name: "oauth_transactions" }, "channel");
};
