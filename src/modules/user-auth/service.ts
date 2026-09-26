import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { Database } from "../../infrastructure/database/database.js";
import type { AppConfig } from "../../infrastructure/configuration/config.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { createOpaqueToken, hashSecret } from "../../shared/security/tokens.js";
import type { AvatarId } from "../../shared/avatars.js";
import {
  createGoogleIdentityProvider,
  type GoogleIdentity,
  type GoogleIdentityProvider,
} from "./google-oauth.js";

export interface UserPrincipal {
  userId: string;
  sessionId: string;
}
type RequestMeta = { ip: string; userAgent: string };
export type OAuthIntent = "login" | "play" | "post_game" | "delete";

const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const DELETION_REAUTH_TTL_MS = 5 * 60 * 1000;
const OAUTH_RETURN_TO: Record<OAuthIntent, string> = {
  login: "/dashboard",
  play: "/dashboard",
  post_game: "/dashboard",
  delete: "/dashboard/settings?reauthenticated=1",
};

export class UserAuthService {
  private readonly google: GoogleIdentityProvider | null;
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig,
    google?: GoogleIdentityProvider | null,
  ) {
    this.google = google === undefined ? createGoogleIdentityProvider(config) : google;
  }
  private tokenHash(token: string) {
    return hashSecret(token, this.config.userSessionTokenPepper);
  }
  private deviceLabel(userAgent: string) {
    const value = userAgent.trim().replace(/\s+/g, " ");
    return value ? value.slice(0, 160) : "Unknown device";
  }
  private async issue(userId: string, meta: RequestMeta) {
    const token = createOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.userSessionTtlSeconds * 1000);
    const id = randomUUID();
    await this.db
      .insertInto("app.user_sessions")
      .values({
        id,
        user_id: userId,
        token_hash: this.tokenHash(token),
        device_label: this.deviceLabel(meta.userAgent),
        ip_hash: hashSecret(meta.ip, this.config.userSessionTokenPepper),
        expires_at: expiresAt,
        last_used_at: now,
        revoked_at: null,
        reauthenticated_at: null,
      })
      .execute();
    return { token, expiresAt: expiresAt.toISOString(), sessionId: id };
  }
  async beginGoogleAuth(
    intent: OAuthIntent,
    participantId: string | null,
    principal: UserPrincipal | null,
  ) {
    if (!this.google)
      throw new ApplicationError(
        503,
        "GOOGLE_AUTH_UNAVAILABLE",
        "Google sign-in is not configured yet.",
      );
    if (intent === "delete" && !principal)
      throw new ApplicationError(401, "USER_SESSION_INVALID", "Sign in to continue.");
    const state = createOpaqueToken();
    const nonce = createOpaqueToken();
    const expiresAt = new Date(Date.now() + OAUTH_TRANSACTION_TTL_MS);
    await this.db
      .deleteFrom("app.oauth_transactions")
      .where("expires_at", "<", new Date())
      .execute();
    await this.db
      .insertInto("app.oauth_transactions")
      .values({
        state_hash: this.tokenHash(state),
        nonce,
        intent,
        participant_id: intent === "delete" ? null : participantId,
        current_user_id: principal?.userId ?? null,
        current_session_id: principal?.sessionId ?? null,
        return_to: OAUTH_RETURN_TO[intent],
        expires_at: expiresAt,
        consumed_at: null,
      })
      .execute();
    return {
      state,
      expiresAt: expiresAt.toISOString(),
      authorizationUrl: this.google.authorizationUrl({ state, nonce }),
    };
  }

  async completeGoogleAuth(input: {
    state: string;
    cookieState: string | null;
    code: string;
    meta: RequestMeta;
  }) {
    if (!this.google)
      throw new ApplicationError(503, "GOOGLE_AUTH_UNAVAILABLE", "Google sign-in is unavailable.");
    if (!input.cookieState || input.cookieState !== input.state)
      throw new ApplicationError(
        400,
        "OAUTH_STATE_INVALID",
        "This sign-in attempt is no longer valid. Please try again.",
      );
    const transaction = await this.db
      .updateTable("app.oauth_transactions")
      .set({ consumed_at: new Date() })
      .where("state_hash", "=", this.tokenHash(input.state))
      .where("consumed_at", "is", null)
      .where("expires_at", ">", new Date())
      .returningAll()
      .executeTakeFirst();
    if (!transaction)
      throw new ApplicationError(
        400,
        "OAUTH_TRANSACTION_EXPIRED",
        "This sign-in attempt expired or was already used. Please try again.",
      );
    const identity = await this.google.exchange(input.code, transaction.nonce);
    if (!identity.emailVerified)
      throw new ApplicationError(
        401,
        "GOOGLE_EMAIL_UNVERIFIED",
        "A verified Google email address is required.",
      );

    if (transaction.intent === "delete") {
      const linked = await this.db
        .selectFrom("app.user_identities")
        .select("user_id")
        .where("provider", "=", "google")
        .where("provider_subject", "=", identity.subject)
        .executeTakeFirst();
      if (
        !linked ||
        linked.user_id !== transaction.current_user_id ||
        !transaction.current_session_id
      )
        throw new ApplicationError(
          403,
          "REAUTH_ACCOUNT_MISMATCH",
          "Use the same Google account that is signed in to this dashboard.",
        );
      await this.db
        .updateTable("app.user_sessions")
        .set({ reauthenticated_at: new Date() })
        .where("id", "=", transaction.current_session_id)
        .where("user_id", "=", linked.user_id)
        .where("revoked_at", "is", null)
        .execute();
      return {
        intent: transaction.intent,
        returnTo: transaction.return_to,
        participantId: null,
        user: await this.profileById(linked.user_id),
        session: null,
      };
    }

    const userId = await this.resolveGoogleAccount(identity);
    return {
      intent: transaction.intent,
      returnTo: transaction.return_to,
      participantId: transaction.participant_id,
      user: await this.profileById(userId),
      session: await this.issue(userId, input.meta),
    };
  }

  private async resolveGoogleAccount(identity: GoogleIdentity): Promise<string> {
    const linked = await this.db
      .selectFrom("app.user_identities as i")
      .innerJoin("app.user_accounts as u", "u.id", "i.user_id")
      .select(["i.user_id as userId", "u.status"])
      .where("i.provider", "=", "google")
      .where("i.provider_subject", "=", identity.subject)
      .executeTakeFirst();
    if (linked) {
      if (linked.status !== "active")
        throw new ApplicationError(403, "ACCOUNT_DISABLED", "This account is disabled.");
      await this.db
        .updateTable("app.user_identities")
        .set({ email: identity.email, updated_at: new Date() })
        .where("provider", "=", "google")
        .where("provider_subject", "=", identity.subject)
        .execute();
      return linked.userId;
    }

    let account = await this.db
      .selectFrom("app.user_accounts")
      .select(["id", "status"])
      .where("email", "=", identity.email)
      .executeTakeFirst();
    if (account?.status === "disabled")
      throw new ApplicationError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    const userId = account?.id ?? randomUUID();
    if (!account) {
      const fallbackName = identity.email.split("@")[0] || "Player";
      const displayName = (identity.name || fallbackName).replace(/\s+/g, " ").trim().slice(0, 24);
      await this.db
        .insertInto("app.user_accounts")
        .values({
          id: userId,
          email: identity.email,
          display_name: displayName || "Player",
          default_avatar_id: "fox",
          password_hash: null,
          status: "active",
          updated_at: new Date(),
        })
        .execute();
      account = { id: userId, status: "active" };
    }
    const existingProvider = await this.db
      .selectFrom("app.user_identities")
      .select("provider_subject")
      .where("provider", "=", "google")
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (existingProvider && existingProvider.provider_subject !== identity.subject)
      throw new ApplicationError(
        409,
        "GOOGLE_IDENTITY_CONFLICT",
        "That email is already connected to another Google account.",
      );
    try {
      await this.db
        .insertInto("app.user_identities")
        .values({
          id: randomUUID(),
          user_id: userId,
          provider: "google",
          provider_subject: identity.subject,
          email: identity.email,
          updated_at: new Date(),
        })
        .execute();
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new ApplicationError(
          409,
          "GOOGLE_IDENTITY_CONFLICT",
          "That Google account is already connected elsewhere.",
        );
      throw error;
    }
    return userId;
  }
  async authenticate(token: string | null): Promise<UserPrincipal | null> {
    if (!token) return null;
    const row = await this.db
      .selectFrom("app.user_sessions as s")
      .innerJoin("app.user_accounts as u", "u.id", "s.user_id")
      .select(["s.id as sessionId", "s.user_id as userId", "s.last_used_at"])
      .where("s.token_hash", "=", this.tokenHash(token))
      .where("s.expires_at", ">", new Date())
      .where("s.revoked_at", "is", null)
      .where("u.status", "=", "active")
      .executeTakeFirst();
    if (!row) return null;
    if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000)
      await this.db
        .updateTable("app.user_sessions")
        .set({ last_used_at: new Date() })
        .where("id", "=", row.sessionId)
        .execute();
    return { userId: row.userId, sessionId: row.sessionId };
  }
  private async profileById(userId: string) {
    const row = await this.db
      .selectFrom("app.user_accounts")
      .select(["id", "email", "display_name", "default_avatar_id", "created_at"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarId: row.default_avatar_id,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
  profile(principal: UserPrincipal) {
    return this.profileById(principal.userId);
  }
  async updateProfile(
    principal: UserPrincipal,
    input: { displayName?: string; avatarId?: AvatarId },
  ) {
    await this.db
      .updateTable("app.user_accounts")
      .set({
        ...(input.displayName ? { display_name: input.displayName } : {}),
        ...(input.avatarId ? { default_avatar_id: input.avatarId } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", principal.userId)
      .execute();
    return this.profile(principal);
  }
  async claimParticipant(
    principal: UserPrincipal,
    participantId: string,
  ): Promise<"linked" | "already_linked" | "conflict"> {
    const participant = await this.db
      .selectFrom("app.participants")
      .select(["room_id", "user_id"])
      .where("id", "=", participantId)
      .where("membership_status", "=", "joined")
      .executeTakeFirst();
    if (!participant) return "conflict";
    if (participant.user_id === principal.userId) return "already_linked";
    if (participant.user_id) return "conflict";
    const owned = await this.db
      .selectFrom("app.participants")
      .select("id")
      .where("room_id", "=", participant.room_id)
      .where("user_id", "=", principal.userId)
      .where("membership_status", "=", "joined")
      .executeTakeFirst();
    if (owned) return "conflict";
    await this.db
      .updateTable("app.participants")
      .set({ user_id: principal.userId })
      .where("id", "=", participantId)
      .where("user_id", "is", null)
      .execute();
    return "linked";
  }
  async sessions(principal: UserPrincipal) {
    const rows = await this.db
      .selectFrom("app.user_sessions")
      .select(["id", "device_label", "issued_at", "last_used_at", "expires_at"])
      .where("user_id", "=", principal.userId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .orderBy("last_used_at", "desc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      deviceLabel: r.device_label,
      issuedAt: new Date(r.issued_at).toISOString(),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
      expiresAt: new Date(r.expires_at).toISOString(),
      current: r.id === principal.sessionId,
    }));
  }
  async revokeSession(principal: UserPrincipal, sessionId: string) {
    await this.db
      .updateTable("app.user_sessions")
      .set({ revoked_at: new Date() })
      .where("id", "=", sessionId)
      .where("user_id", "=", principal.userId)
      .execute();
  }
  async revokeOthers(principal: UserPrincipal) {
    await this.db
      .updateTable("app.user_sessions")
      .set({ revoked_at: new Date() })
      .where("user_id", "=", principal.userId)
      .where("id", "!=", principal.sessionId)
      .where("revoked_at", "is", null)
      .execute();
  }
  async deleteAccount(principal: UserPrincipal) {
    const session = await this.db
      .selectFrom("app.user_sessions")
      .select("reauthenticated_at")
      .where("id", "=", principal.sessionId)
      .where("user_id", "=", principal.userId)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    if (
      !session?.reauthenticated_at ||
      Date.now() - new Date(session.reauthenticated_at).getTime() > DELETION_REAUTH_TTL_MS
    )
      throw new ApplicationError(
        403,
        "RECENT_GOOGLE_AUTH_REQUIRED",
        "Confirm your Google account again before deleting your account.",
      );
    await this.db.deleteFrom("app.user_accounts").where("id", "=", principal.userId).execute();
  }
  async dashboard(principal: UserPrincipal) {
    const rooms = await this.db
      .selectFrom("app.participants as p")
      .innerJoin("app.rooms as r", "r.id", "p.room_id")
      .select([
        "p.id as participantId",
        "p.nickname",
        "p.avatar_id as avatarId",
        "r.id",
        "r.code",
        "r.status",
        "r.host_participant_id",
        "r.expires_at",
        "r.last_activity_at",
      ])
      .where("p.user_id", "=", principal.userId)
      .where("p.membership_status", "=", "joined")
      .orderBy("r.last_activity_at", "desc")
      .execute();
    const games = await this.history(principal, 5);
    const stats = await this.db
      .selectFrom("app.game_participants as gp")
      .innerJoin("app.participants as p", "p.id", "gp.participant_id")
      .innerJoin("app.games as g", "g.id", "gp.game_id")
      .leftJoin("app.task_assignments as ta", (join) =>
        join.onRef("ta.game_id", "=", "g.id").onRef("ta.participant_id", "=", "p.id"),
      )
      .select([
        sql<number>`count(distinct g.id)::int`.as("games"),
        sql<number>`count(distinct g.id) filter (where (g.winner = 'crew' and gp.role = 'crew') or (g.winner = 'imposters' and gp.role = 'imposter'))::int`.as(
          "wins",
        ),
        sql<number>`count(distinct g.id) filter (where gp.role = 'crew')::int`.as("crewGames"),
        sql<number>`count(distinct g.id) filter (where gp.role = 'imposter')::int`.as(
          "imposterGames",
        ),
        sql<number>`count(ta.id) filter (where ta.status = 'completed')::int`.as("tasksCompleted"),
        sql<number>`count(ta.id)::int`.as("tasksTotal"),
        sql<number>`count(distinct g.id) filter (where gp.life_status = 'alive')::int`.as(
          "survived",
        ),
      ])
      .where("p.user_id", "=", principal.userId)
      .where("g.phase", "in", ["game_over", "abandoned"])
      .executeTakeFirstOrThrow();
    const hosted = rooms.filter((r) => r.host_participant_id === r.participantId).length;
    return {
      rooms: rooms.map((r) => ({
        participantId: r.participantId,
        nickname: r.nickname,
        avatarId: r.avatarId,
        roomId: r.id,
        code: r.code,
        status: r.status,
        isHost: r.host_participant_id === r.participantId,
        expiresAt: new Date(r.expires_at).toISOString(),
        rejoinable: r.status !== "expired" && new Date(r.expires_at) > new Date(),
      })),
      recentGames: games.items,
      stats: {
        ...stats,
        hosted,
        winRate: stats.games ? Math.round((stats.wins / stats.games) * 100) : 0,
        taskCompletionRate: stats.tasksTotal
          ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)
          : 0,
        survivalRate: stats.games ? Math.round((stats.survived / stats.games) * 100) : 0,
      },
    };
  }
  async history(principal: UserPrincipal, limit = 20, cursor?: string) {
    let query = this.db
      .selectFrom("app.game_participants as gp")
      .innerJoin("app.participants as p", "p.id", "gp.participant_id")
      .innerJoin("app.games as g", "g.id", "gp.game_id")
      .innerJoin("app.rooms as r", "r.id", "g.room_id")
      .select([
        "g.id",
        "g.room_id as roomId",
        "r.code",
        "g.task_pack_name_snapshot as taskPackName",
        "g.winner",
        "g.end_reason as endReason",
        "g.phase",
        "g.started_at",
        "g.ended_at",
        "gp.role",
        "gp.life_status as lifeStatus",
        sql<number>`(select count(*)::int from app.game_participants x where x.game_id = g.id)`.as(
          "playerCount",
        ),
      ])
      .where("p.user_id", "=", principal.userId)
      .where("g.phase", "in", ["game_over", "abandoned"]);
    if (cursor) query = query.where("g.started_at", "<", new Date(cursor));
    const rows = await query
      .orderBy("g.started_at", "desc")
      .limit(limit + 1)
      .execute();
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((r) => ({
        ...r,
        won:
          (r.winner === "crew" && r.role === "crew") ||
          (r.winner === "imposters" && r.role === "imposter"),
        startedAt: new Date(r.started_at).toISOString(),
        endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
      })),
      nextCursor: more ? new Date(page[page.length - 1].started_at).toISOString() : null,
    };
  }
  async gameDetail(principal: UserPrincipal, gameId: string) {
    const own = await this.db
      .selectFrom("app.game_participants as gp")
      .innerJoin("app.participants as p", "p.id", "gp.participant_id")
      .innerJoin("app.games as g", "g.id", "gp.game_id")
      .innerJoin("app.rooms as r", "r.id", "g.room_id")
      .select([
        "g.id",
        "g.winner",
        "g.end_reason",
        "g.task_pack_name_snapshot",
        "g.started_at",
        "g.ended_at",
        "r.code",
        "r.vote_visibility",
        "gp.role",
        "gp.life_status",
      ])
      .where("g.id", "=", gameId)
      .where("p.user_id", "=", principal.userId)
      .where("g.phase", "in", ["game_over", "abandoned"])
      .executeTakeFirst();
    if (!own)
      throw new ApplicationError(
        404,
        "GAME_NOT_FOUND",
        "That game is not available in your history.",
      );
    const players = await this.db
      .selectFrom("app.game_participants as gp")
      .innerJoin("app.participants as p", "p.id", "gp.participant_id")
      .leftJoin("app.task_assignments as ta", (join) =>
        join
          .onRef("ta.game_id", "=", "gp.game_id")
          .onRef("ta.participant_id", "=", "gp.participant_id"),
      )
      .select([
        "p.id",
        "p.nickname",
        "p.avatar_id as avatarId",
        "gp.role",
        "gp.life_status as lifeStatus",
        sql<number>`count(ta.id)::int`.as("totalTasks"),
        sql<number>`count(ta.id) filter (where ta.status = 'completed')::int`.as("completedTasks"),
      ])
      .where("gp.game_id", "=", gameId)
      .groupBy(["p.id", "p.nickname", "p.avatar_id", "gp.role", "gp.life_status"])
      .orderBy("p.nickname")
      .execute();
    const ballots =
      own.vote_visibility === "public"
        ? await this.db
            .selectFrom("app.ejection_votes as v")
            .innerJoin("app.meetings as m", "m.id", "v.meeting_id")
            .innerJoin("app.participants as voter", "voter.id", "v.voter_participant_id")
            .leftJoin("app.participants as target", "target.id", "v.target_participant_id")
            .select([
              "m.sequence_number as meeting",
              "voter.nickname as voter",
              "target.nickname as target",
            ])
            .where("m.game_id", "=", gameId)
            .orderBy("m.sequence_number")
            .orderBy("v.created_at")
            .execute()
        : [];
    const eliminations = await this.db
      .selectFrom("app.eliminations as e")
      .innerJoin("app.participants as target", "target.id", "e.target_participant_id")
      .leftJoin("app.participants as actor", "actor.id", "e.actor_participant_id")
      .select(["e.type", "e.occurred_at", "target.nickname as target", "actor.nickname as actor"])
      .where("e.game_id", "=", gameId)
      .orderBy("e.occurred_at")
      .execute();
    return {
      id: own.id,
      code: own.code,
      taskPackName: own.task_pack_name_snapshot,
      winner: own.winner,
      endReason: own.end_reason,
      role: own.role,
      lifeStatus: own.life_status,
      startedAt: new Date(own.started_at).toISOString(),
      endedAt: own.ended_at ? new Date(own.ended_at).toISOString() : null,
      players,
      voteVisibility: own.vote_visibility,
      ballots,
      eliminations: eliminations.map((item) => ({
        type: item.type,
        target: item.target,
        actor: item.actor,
        occurredAt: new Date(item.occurred_at).toISOString(),
      })),
    };
  }
}
