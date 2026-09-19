import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import { TaskPackRepository } from "../../src/modules/task-packs/repository.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("task-pack lifecycle persistence", () => {
  let dependencies: DatabaseDependencies;
  let repository: TaskPackRepository;
  const adminId = randomUUID();
  const packName = `Integration ${randomUUID()}`;

  beforeAll(async () => {
    dependencies = createDatabase(loadConfig({ APP_ENV: "test", DATABASE_URL: connectionString! }));
    repository = new TaskPackRepository(dependencies.db);
    await dependencies.db
      .insertInto("app.admin_users")
      .values({
        id: adminId,
        email: `${adminId}@example.com`,
        password_hash: "test-only",
        status: "active",
        last_login_at: null,
      })
      .execute();
  });

  afterAll(async () => {
    await dependencies.db
      .deleteFrom("app.task_packs")
      .where("created_by_admin_id", "=", adminId)
      .execute();
    await dependencies.db.deleteFrom("app.admin_users").where("id", "=", adminId).execute();
    await closeDatabase(dependencies);
  });

  it("isolates drafts, enforces revisions, publishes, projects, and archives", async () => {
    const created = await repository.create(
      { name: packName, description: "A draft", items: [] },
      adminId,
      "req-create",
      "create-key-1",
    );
    const replayed = await repository.create(
      { name: packName, description: "A draft", items: [] },
      adminId,
      "req-replay",
      "create-key-1",
    );
    expect(replayed.id).toBe(created.id);
    expect(await repository.getPublic(created.id)).toBeNull();
    await expect(
      repository.transition(
        created.id,
        1,
        "published",
        adminId,
        "req-bad-publish",
        "publish-key-1",
      ),
    ).rejects.toMatchObject({ code: "PACK_NOT_PUBLISHABLE" });

    const items = Array.from({ length: 3 }, (_, index) => ({
      description: `Task ${index + 1}`,
      isActive: true,
    }));
    const updated = await repository.update(
      created.id,
      { expectedRevision: 1, items },
      adminId,
      "req-update",
      "update-key-1",
    );
    expect(updated.items.map((item) => item.position)).toEqual([1, 2, 3]);
    await expect(
      repository.update(
        created.id,
        { expectedRevision: 1, name: "Stale" },
        adminId,
        "req-stale",
        "update-key-2",
      ),
    ).rejects.toMatchObject({ code: "PACK_REVISION_CONFLICT" });

    const published = await repository.transition(
      created.id,
      2,
      "published",
      adminId,
      "req-publish",
      "publish-key-2",
    );
    expect(published.status).toBe("published");
    const projection = await repository.getPublic(created.id);
    expect(projection).toMatchObject({
      id: created.id,
      activeTaskCount: 3,
      difficultyTaskCounts: { easy: 0, medium: 3, hard: 0 },
      revision: 3,
    });
    expect(projection).not.toHaveProperty("slug");
    expect(projection).not.toHaveProperty("status");

    const archived = await repository.transition(
      created.id,
      3,
      "archived",
      adminId,
      "req-archive",
      "archive-key-1",
    );
    expect(archived.status).toBe("archived");
    expect(await repository.getPublic(created.id)).toBeNull();
  });

  it("creates and deletes a draft with difficulty tasks and crew roles", async () => {
    const suffix = randomUUID();
    const created = await repository.create(
      {
        name: `Configured map ${suffix}`,
        description: "Admin editor payload",
        items: [
          { description: "Lobby", isActive: true, difficulty: "easy" },
          { description: "Spider-Man", isActive: true, difficulty: "medium" },
          { description: "Iron Man", isActive: true, difficulty: "hard" },
        ],
        roles: [
          { name: "Doctor Strange", specialization: "Magic", ability: "Time control" },
          { name: "Captain America", specialization: "Combat", ability: "Leadership" },
        ],
      },
      adminId,
      `req-configured-${suffix}`,
      `create-configured-${suffix}`,
    );
    expect(created.items.map((item) => item.difficulty)).toEqual(["easy", "medium", "hard"]);
    expect(created.roles).toHaveLength(2);

    await expect(
      repository.delete(
        created.id,
        created.revision,
        adminId,
        `req-delete-${suffix}`,
        `delete-configured-${suffix}`,
      ),
    ).resolves.toEqual({ deleted: true, id: created.id });
    await expect(repository.getAdmin(created.id)).resolves.toBeNull();
  });
});
