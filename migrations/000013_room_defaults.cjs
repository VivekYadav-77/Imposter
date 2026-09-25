/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.alterColumn({ schema: "app", name: "rooms" }, "max_players", { default: 15 });
  pgm.alterColumn({ schema: "app", name: "rooms" }, "evidence_visibility", {
    default: "private",
  });
};

exports.down = (pgm) => {
  pgm.alterColumn({ schema: "app", name: "rooms" }, "max_players", { default: 12 });
  pgm.alterColumn({ schema: "app", name: "rooms" }, "evidence_visibility", {
    default: "public",
  });
};
