import { createHash, randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";

import type { Database, DatabaseSchema } from "../../infrastructure/database/database.js";
import { inTransaction } from "../../infrastructure/database/transaction.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import type { CreatePackInput, UpdatePackInput } from "./schemas.js";
import type {
  AdminPackDto,
  AdminPackSummaryDto,
  PackItemDto,
  PackStatus,
  PublicPackDetailDto,
  PublicPackSummaryDto,
} from "./types.js";

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return base || `pack-${randomUUID().slice(0, 8)}`;
}

async function loadPack(
  executor: Database | Transaction<DatabaseSchema>,
  id: string,
): Promise<AdminPackDto | null> {
  const pack = await executor
    .selectFrom("app.task_packs")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!pack) return null;
  const items = await executor
    .selectFrom("app.task_pack_items")
    .selectAll()
    .where("task_pack_id", "=", id)
    .orderBy("position")
    .execute();
  return {
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    description: pack.description,
    status: pack.status,
    revision: pack.revision,
    publishedAt: pack.published_at ? iso(pack.published_at) : null,
    createdAt: iso(pack.created_at),
    updatedAt: iso(pack.updated_at),
    roles: pack.roles,
    items: items.map((item): PackItemDto => ({
      id: item.id,
      position: item.position,
      description: item.description,
      isActive: item.is_active,
      difficulty: item.difficulty,
    })),
  };
}

async function audit(
  transaction: Transaction<DatabaseSchema>,
  input: {
    adminId: string;
    action: string;
    packId: string;
    requestId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await transaction
    .insertInto("app.admin_audit_events")
    .values({
      id: randomUUID(),
      admin_user_id: input.adminId,
      action: input.action,
      target_type: "task_pack",
      target_id: input.packId,
      request_id: input.requestId,
      ip_hash: null,
      outcome: "success",
      metadata: input.metadata ?? {},
    })
    .execute();
}

function requestHash(operation: string, input: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, input })).digest("base64url");
}

async function replay<T = AdminPackDto>(
  transaction: Transaction<DatabaseSchema>,
  adminId: string,
  key: string,
  operation: string,
  input: unknown,
): Promise<T | null> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`${adminId}:${key}`}, 0))`.execute(
    transaction,
  );
  const existing = await transaction
    .selectFrom("app.admin_idempotency_records")
    .select(["operation", "request_hash", "response_body", "expires_at"])
    .where("admin_user_id", "=", adminId)
    .where("key", "=", key)
    .executeTakeFirst();
  if (!existing) return null;
  // Idempotency records are deliberately short-lived. Remove an expired
  // record while holding the same transaction advisory lock so the key can
  // safely be reused without colliding with the composite primary key.
  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    await transaction
      .deleteFrom("app.admin_idempotency_records")
      .where("admin_user_id", "=", adminId)
      .where("key", "=", key)
      .execute();
    return null;
  }
  if (existing.operation !== operation || existing.request_hash !== requestHash(operation, input))
    throw new ApplicationError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "The Idempotency-Key was already used for a different request.",
    );
  return existing.response_body as unknown as T;
}

async function remember<T>(
  transaction: Transaction<DatabaseSchema>,
  adminId: string,
  key: string,
  operation: string,
  input: unknown,
  response: T,
): Promise<void> {
  await transaction
    .insertInto("app.admin_idempotency_records")
    .values({
      admin_user_id: adminId,
      key,
      operation,
      request_hash: requestHash(operation, input),
      response_body: response as unknown as Record<string, unknown>,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .execute();
}

export class TaskPackRepository {
  constructor(private readonly database: Database) {}

  async create(
    input: CreatePackInput,
    adminId: string,
    requestId: string,
    idempotencyKey: string,
  ): Promise<AdminPackDto> {
    const inputItems = (input.items ?? []).map((item) =>
      typeof item === "string"
        ? { description: item, isActive: true, difficulty: "medium" as const }
        : {
            description: item.description,
            isActive: item.isActive ?? true,
            difficulty: item.difficulty ?? ("medium" as const),
          },
    );
    try {
      return await inTransaction(this.database, async (trx) => {
        const previous = await replay(trx, adminId, idempotencyKey, "task_pack.create", input);
        if (previous) return previous;
        const id = randomUUID();
        await trx
          .insertInto("app.task_packs")
          .values({
            id,
            created_by_admin_id: adminId,
            slug: slugify(input.name),
            name: input.name,
            description: input.description ?? null,
            status: "draft",
            published_at: null,
            roles: sql<
              Array<{ name: string; specialization: string; ability: string }>
            >`${JSON.stringify(input.roles ?? [])}::jsonb`,
          })
          .execute();
        if (inputItems.length)
          await trx
            .insertInto("app.task_pack_items")
            .values(
              inputItems.map((item, index) => ({
                id: randomUUID(),
                task_pack_id: id,
                position: index + 1,
                description: item.description,
                is_active: item.isActive,
                difficulty: item.difficulty ?? "medium",
              })),
            )
            .execute();
        await audit(trx, {
          adminId,
          action: "task_pack.created",
          packId: id,
          requestId,
          metadata: { itemCount: inputItems.length },
        });
        const response = (await loadPack(trx, id))!;
        await remember(trx, adminId, idempotencyKey, "task_pack.create", input, response);
        return response;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new ApplicationError(
          409,
          "PACK_SLUG_CONFLICT",
          "A task pack with this slug already exists.",
        );
      throw error;
    }
  }

  getAdmin(id: string): Promise<AdminPackDto | null> {
    return loadPack(this.database, id);
  }

  async update(
    id: string,
    input: UpdatePackInput,
    adminId: string,
    requestId: string,
    idempotencyKey: string,
  ): Promise<AdminPackDto> {
    return inTransaction(this.database, async (trx) => {
      const operation = `task_pack.update:${id}`;
      const previous = await replay(trx, adminId, idempotencyKey, operation, input);
      if (previous) return previous;
      const current = await trx
        .selectFrom("app.task_packs")
        .select(["revision", "status"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new ApplicationError(404, "NOT_FOUND", "The task pack was not found.");
      if (current.status === "archived")
        throw new ApplicationError(
          422,
          "VALIDATION_FAILED",
          "Archived task packs cannot be edited.",
        );
      if (current.revision !== input.expectedRevision)
        throw new ApplicationError(
          409,
          "PACK_REVISION_CONFLICT",
          "The task pack was changed by another request.",
          { currentRevision: current.revision },
        );
      const values: {
        name?: string;
        description?: string | null;
        revision: number;
        updated_at: Date;
      } = { revision: current.revision + 1, updated_at: new Date() };
      if (input.name !== undefined) values.name = input.name;
      if (input.description !== undefined) values.description = input.description ?? null;
      await trx.updateTable("app.task_packs").set(values).where("id", "=", id).execute();
      if (input.roles !== undefined)
        await trx
          .updateTable("app.task_packs")
          .set({
            roles: sql<
              Array<{ name: string; specialization: string; ability: string }>
            >`${JSON.stringify(input.roles)}::jsonb`,
          })
          .where("id", "=", id)
          .execute();
      if (input.items !== undefined) {
        const inputItems = input.items.map((item) =>
          typeof item === "string"
            ? { description: item, isActive: true, difficulty: "medium" as const }
            : {
                description: item.description,
                isActive: item.isActive ?? true,
                difficulty: item.difficulty ?? ("medium" as const),
              },
        );
        await trx.deleteFrom("app.task_pack_items").where("task_pack_id", "=", id).execute();
        if (inputItems.length)
          await trx
            .insertInto("app.task_pack_items")
            .values(
              inputItems.map((item, index) => ({
                id: randomUUID(),
                task_pack_id: id,
                position: index + 1,
                description: item.description,
                is_active: item.isActive,
                difficulty: item.difficulty ?? "medium",
              })),
            )
            .execute();
      }
      await audit(trx, {
        adminId,
        action: "task_pack.updated",
        packId: id,
        requestId,
        metadata: { revision: current.revision + 1, itemsReplaced: input.items !== undefined },
      });
      const response = (await loadPack(trx, id))!;
      await remember(trx, adminId, idempotencyKey, operation, input, response);
      return response;
    });
  }

  async transition(
    id: string,
    expectedRevision: number,
    target: "published" | "archived",
    adminId: string,
    requestId: string,
    idempotencyKey: string,
  ): Promise<AdminPackDto> {
    return inTransaction(this.database, async (trx) => {
      const operation = `task_pack.${target}:${id}`;
      const idempotencyInput = { expectedRevision };
      const previous = await replay(trx, adminId, idempotencyKey, operation, idempotencyInput);
      if (previous) return previous;
      const current = await trx
        .selectFrom("app.task_packs")
        .select(["revision", "status"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new ApplicationError(404, "NOT_FOUND", "The task pack was not found.");
      if (current.revision !== expectedRevision)
        throw new ApplicationError(
          409,
          "PACK_REVISION_CONFLICT",
          "The task pack was changed by another request.",
          { currentRevision: current.revision },
        );
      if (target === "published") {
        if (current.status !== "draft")
          throw new ApplicationError(
            422,
            "PACK_NOT_PUBLISHABLE",
            "Only draft task packs can be published.",
          );
        const count = await trx
          .selectFrom("app.task_pack_items")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("task_pack_id", "=", id)
          .where("is_active", "=", true)
          .executeTakeFirstOrThrow();
        if (count.count < 3 || count.count > 15)
          throw new ApplicationError(
            422,
            "PACK_NOT_PUBLISHABLE",
            "A published map must contain 3 to 15 active tasks.",
            { activeItemCount: count.count },
          );
      } else if (current.status !== "published") {
        throw new ApplicationError(
          422,
          "VALIDATION_FAILED",
          "Only published task packs can be archived.",
        );
      }
      const now = new Date();
      await trx
        .updateTable("app.task_packs")
        .set({
          status: target,
          revision: current.revision + 1,
          updated_at: now,
          ...(target === "published" ? { published_at: now } : {}),
        })
        .where("id", "=", id)
        .execute();
      await audit(trx, {
        adminId,
        action: `task_pack.${target}`,
        packId: id,
        requestId,
        metadata: { revision: current.revision + 1 },
      });
      const response = (await loadPack(trx, id))!;
      await remember(trx, adminId, idempotencyKey, operation, idempotencyInput, response);
      return response;
    });
  }

  async delete(
    id: string,
    expectedRevision: number,
    adminId: string,
    requestId: string,
    idempotencyKey: string,
  ): Promise<{ deleted: true; id: string }> {
    return inTransaction(this.database, async (trx) => {
      const operation = `task_pack.delete:${id}`;
      const input = { expectedRevision };
      const previous = await replay<{ deleted: true; id: string }>(
        trx,
        adminId,
        idempotencyKey,
        operation,
        input,
      );
      if (previous) return previous;
      const current = await trx
        .selectFrom("app.task_packs")
        .select(["id", "revision", "name"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new ApplicationError(404, "NOT_FOUND", "The map was not found.");
      if (current.revision !== expectedRevision)
        throw new ApplicationError(
          409,
          "PACK_REVISION_CONFLICT",
          "The map changed before it could be deleted.",
          { currentRevision: current.revision },
        );
      const [games, rooms] = await Promise.all([
        trx
          .selectFrom("app.games")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("source_task_pack_id", "=", id)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.rooms")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("selected_task_pack_id", "=", id)
          .where("status", "in", ["lobby", "active"])
          .executeTakeFirstOrThrow(),
      ]);
      if (games.count > 0 || rooms.count > 0)
        throw new ApplicationError(
          409,
          "MAP_IN_USE",
          "This map is used by a room or game and cannot be deleted. Archive it instead.",
          { gameCount: games.count, activeRoomCount: rooms.count },
        );
      await audit(trx, {
        adminId,
        action: "task_pack.deleted",
        packId: id,
        requestId,
        metadata: { name: current.name, revision: current.revision },
      });
      await trx.deleteFrom("app.task_packs").where("id", "=", id).execute();
      const response = { deleted: true as const, id };
      await remember(trx, adminId, idempotencyKey, operation, input, response);
      return response;
    });
  }

  async listAdmin(
    status?: PackStatus,
    search?: string,
    limit = 20,
    offset = 0,
    sort: "updated_desc" | "name_asc" = "updated_desc",
  ): Promise<AdminPackSummaryDto[]> {
    let query = this.database
      .selectFrom("app.task_packs as packs")
      .leftJoin("app.task_pack_items as items", "items.task_pack_id", "packs.id")
      .select([
        "packs.id",
        "packs.slug",
        "packs.name",
        "packs.description",
        "packs.status",
        "packs.revision",
        "packs.published_at",
        "packs.created_at",
        "packs.updated_at",
        "packs.roles",
        sql<number>`count(items.id)::int`.as("itemCount"),
        sql<number>`count(items.id) filter (where items.is_active)::int`.as("activeItemCount"),
      ])
      .groupBy("packs.id")
      .limit(limit)
      .offset(offset);
    query =
      sort === "name_asc"
        ? query.orderBy("packs.name").orderBy("packs.id")
        : query.orderBy("packs.updated_at", "desc").orderBy("packs.id");
    if (status) query = query.where("packs.status", "=", status);
    if (search)
      query = query.where(
        "packs.name",
        "ilike",
        `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
      );
    const rows = await query.execute();
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      status: row.status,
      revision: row.revision,
      publishedAt: row.published_at ? iso(row.published_at) : null,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      itemCount: row.itemCount,
      activeItemCount: row.activeItemCount,
      roles: row.roles,
    }));
  }

  async listPublic(search?: string, limit = 20, offset = 0): Promise<PublicPackSummaryDto[]> {
    let query = this.database
      .selectFrom("app.task_packs as packs")
      .innerJoin("app.task_pack_items as items", "items.task_pack_id", "packs.id")
      .select([
        "packs.id",
        "packs.name",
        "packs.description",
        "packs.revision",
        "packs.roles",
        sql<number>`count(items.id)::int`.as("activeTaskCount"),
        sql<number>`count(items.id) filter (where items.difficulty = 'easy')::int`.as(
          "easyTaskCount",
        ),
        sql<number>`count(items.id) filter (where items.difficulty = 'medium')::int`.as(
          "mediumTaskCount",
        ),
        sql<number>`count(items.id) filter (where items.difficulty = 'hard')::int`.as(
          "hardTaskCount",
        ),
      ])
      .where("packs.status", "=", "published")
      .where("items.is_active", "=", true)
      .groupBy("packs.id")
      .orderBy("packs.name")
      .orderBy("packs.id")
      .limit(limit)
      .offset(offset);
    if (search)
      query = query.where(
        "packs.name",
        "ilike",
        `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
      );
    return (await query.execute()).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      revision: row.revision,
      activeTaskCount: row.activeTaskCount,
      difficultyTaskCounts: {
        easy: row.easyTaskCount,
        medium: row.mediumTaskCount,
        hard: row.hardTaskCount,
      },
      roles: row.roles,
    }));
  }

  async getPublic(id: string): Promise<PublicPackDetailDto | null> {
    const pack = await this.database
      .selectFrom("app.task_packs")
      .select(["id", "name", "description", "revision", "roles"])
      .where("id", "=", id)
      .where("status", "=", "published")
      .executeTakeFirst();
    if (!pack) return null;
    const items = await this.database
      .selectFrom("app.task_pack_items")
      .select(["position", "description", "difficulty"])
      .where("task_pack_id", "=", id)
      .where("is_active", "=", true)
      .orderBy("position")
      .execute();
    return {
      ...pack,
      activeTaskCount: items.length,
      difficultyTaskCounts: {
        easy: items.filter((item) => item.difficulty === "easy").length,
        medium: items.filter((item) => item.difficulty === "medium").length,
        hard: items.filter((item) => item.difficulty === "hard").length,
      },
      items,
    };
  }
}
