import { randomUUID } from "node:crypto";

import type { Database } from "../../infrastructure/database/database.js";
import type {
  AdminAccountSummary,
  AdminAuthRepository,
  AdminPrincipal,
  AdminUserRecord,
  AuditEvent,
} from "./types.js";

export class PostgresAdminAuthRepository implements AdminAuthRepository {
  constructor(private readonly database: Database) {}

  async findUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const row = await this.database
      .selectFrom("app.admin_users")
      .select(["id", "email", "password_hash", "status"])
      .where("email", "=", email)
      .executeTakeFirst();
    return row
      ? { id: row.id, email: row.email, passwordHash: row.password_hash, status: row.status }
      : null;
  }

  async createSession(input: {
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: Date;
    ipHash: string | null;
  }): Promise<void> {
    await this.database
      .insertInto("app.admin_sessions")
      .values({
        id: input.id,
        admin_user_id: input.adminUserId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        last_used_at: null,
        revoked_at: null,
        created_ip_hash: input.ipHash,
      })
      .execute();
  }

  async resolveSession(tokenHash: string, now: Date): Promise<AdminPrincipal | null> {
    const row = await this.database
      .selectFrom("app.admin_sessions as sessions")
      .innerJoin("app.admin_users as users", "users.id", "sessions.admin_user_id")
      .select(["sessions.id as sessionId", "users.id as adminUserId", "users.email"])
      .where("sessions.token_hash", "=", tokenHash)
      .where("sessions.revoked_at", "is", null)
      .where("sessions.expires_at", ">", now)
      .where("users.status", "=", "active")
      .executeTakeFirst();
    return row ?? null;
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.database
      .updateTable("app.admin_sessions")
      .set({ revoked_at: now })
      .where("id", "=", sessionId)
      .where("revoked_at", "is", null)
      .execute();
  }

  async touchSuccessfulLogin(adminUserId: string, now: Date): Promise<void> {
    await this.database
      .updateTable("app.admin_users")
      .set({ last_login_at: now, updated_at: now })
      .where("id", "=", adminUserId)
      .execute();
  }

  async deleteExpiredSessions(now: Date): Promise<number> {
    const result = await this.database
      .deleteFrom("app.admin_sessions")
      .where("expires_at", "<", now)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  async audit(event: AuditEvent): Promise<void> {
    await this.database
      .insertInto("app.admin_audit_events")
      .values({
        id: randomUUID(),
        admin_user_id: event.adminUserId ?? null,
        action: event.action,
        target_type: event.targetType ?? null,
        target_id: event.targetId ?? null,
        request_id: event.requestId ?? null,
        ip_hash: event.ipHash ?? null,
        outcome: event.outcome,
        metadata: event.metadata ?? {},
      })
      .execute();
  }

  async createGoogleTransaction(input: {
    stateHash: string;
    nonce: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database
      .deleteFrom("app.admin_oauth_transactions")
      .where("expires_at", "<", new Date())
      .execute();
    await this.database
      .insertInto("app.admin_oauth_transactions")
      .values({
        state_hash: input.stateHash,
        nonce: input.nonce,
        expires_at: input.expiresAt,
        consumed_at: null,
      })
      .execute();
  }

  async consumeGoogleTransaction(stateHash: string, now: Date): Promise<{ nonce: string } | null> {
    return (
      (await this.database
        .updateTable("app.admin_oauth_transactions")
        .set({ consumed_at: now })
        .where("state_hash", "=", stateHash)
        .where("consumed_at", "is", null)
        .where("expires_at", ">", now)
        .returning("nonce")
        .executeTakeFirst()) ?? null
    );
  }

  async listUserAccounts(): Promise<AdminAccountSummary[]> {
    const rows = await this.database
      .selectFrom("app.user_accounts as users")
      .leftJoin("app.participants as participants", "participants.user_id", "users.id")
      .leftJoin(
        "app.game_participants as game_players",
        "game_players.participant_id",
        "participants.id",
      )
      .leftJoin("app.user_sessions as sessions", "sessions.user_id", "users.id")
      .select((expression) => [
        "users.id",
        "users.email",
        "users.display_name",
        "users.default_avatar_id",
        "users.status",
        "users.created_at",
        expression.fn.max("sessions.last_used_at").as("lastActiveAt"),
        expression.fn.count("game_players.game_id").distinct().as("gamesPlayed"),
      ])
      .groupBy([
        "users.id",
        "users.email",
        "users.display_name",
        "users.default_avatar_id",
        "users.status",
        "users.created_at",
      ])
      .orderBy("users.created_at", "desc")
      .limit(500)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarId: row.default_avatar_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
      gamesPlayed: Number(row.gamesPlayed),
    }));
  }
}
