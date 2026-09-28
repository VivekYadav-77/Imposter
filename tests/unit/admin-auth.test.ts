import { describe, expect, it } from "vitest";

import { AdminAuthService } from "../../src/modules/admin-auth/service.js";
import { MemoryLoginThrottle } from "../../src/modules/admin-auth/throttle.js";
import type {
  AdminAuthRepository,
  AdminPrincipal,
  AdminUserRecord,
  AuditEvent,
} from "../../src/modules/admin-auth/types.js";
import { hashPassword, verifyPassword } from "../../src/shared/security/password.js";

class FakeRepository implements AdminAuthRepository {
  user: AdminUserRecord | null = null;
  principal: AdminPrincipal | null = null;
  audits: AuditEvent[] = [];
  revoked: string[] = [];
  googleTransaction: { stateHash: string; nonce: string } | null = null;

  findUserByEmail(email: string) {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }
  createSession(input: { id: string; adminUserId: string }) {
    this.principal = {
      adminUserId: input.adminUserId,
      email: this.user!.email,
      sessionId: input.id,
    };
    return Promise.resolve();
  }
  resolveSession() {
    return Promise.resolve(this.principal);
  }
  revokeSession(sessionId: string) {
    this.revoked.push(sessionId);
    this.principal = null;
    return Promise.resolve();
  }
  touchSuccessfulLogin() {
    return Promise.resolve();
  }
  deleteExpiredSessions() {
    return Promise.resolve(0);
  }
  audit(event: AuditEvent) {
    this.audits.push(event);
    return Promise.resolve();
  }
  createGoogleTransaction(input: { stateHash: string; nonce: string }) {
    this.googleTransaction = input;
    return Promise.resolve();
  }
  consumeGoogleTransaction(stateHash: string) {
    if (this.googleTransaction?.stateHash !== stateHash) return Promise.resolve(null);
    const transaction = { nonce: this.googleTransaction.nonce };
    this.googleTransaction = null;
    return Promise.resolve(transaction);
  }
}

describe("administrator authentication", () => {
  it("hashes and verifies passwords with a salted memory-hard representation", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong", first)).resolves.toBe(false);
  });

  it("creates and revokes an opaque server-side session", async () => {
    const repository = new FakeRepository();
    repository.user = {
      id: "admin-1",
      email: "owner@example.com",
      passwordHash: await hashPassword("correct horse battery staple"),
      status: "active",
    };
    const service = new AdminAuthService(
      repository,
      new MemoryLoginThrottle(5, 900),
      "x".repeat(32),
      3600,
    );
    const session = await service.login({
      email: " OWNER@example.com ",
      password: "correct horse battery staple",
      ip: "127.0.0.1",
      requestId: "req-1",
    });
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const principal = await service.authenticate(session.token);
    await service.logout(principal, "req-2");
    await expect(service.authenticate(session.token)).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
    expect(repository.audits.map((event) => event.action)).toEqual(["admin.login", "admin.logout"]);
  });

  it("uses a generic error and rate limits repeated failures", async () => {
    const repository = new FakeRepository();
    const service = new AdminAuthService(
      repository,
      new MemoryLoginThrottle(2, 900),
      "x".repeat(32),
      3600,
    );
    const input = {
      email: "missing@example.com",
      password: "wrong",
      ip: "127.0.0.1",
      requestId: "req",
    };
    await expect(service.login(input)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(service.login(input)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(service.login(input)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("allows Google sign-in only for a pre-provisioned active administrator", async () => {
    const repository = new FakeRepository();
    repository.user = {
      id: "admin-1",
      email: "owner@example.com",
      passwordHash: await hashPassword("unused password"),
      status: "active",
    };
    const google = {
      authorizationUrl: ({ state }: { state: string }) =>
        `https://accounts.example/?state=${state}`,
      exchange: () =>
        Promise.resolve({
          subject: "google-owner",
          email: "owner@example.com",
          emailVerified: true,
          name: "Owner",
        }),
    };
    const service = new AdminAuthService(
      repository,
      new MemoryLoginThrottle(5, 900),
      "x".repeat(32),
      3600,
      google,
    );
    const transaction = await service.beginGoogleLogin();
    const session = await service.completeGoogleLogin({
      state: transaction.state,
      cookieState: transaction.state,
      code: "one-time-code",
      ip: "127.0.0.1",
      requestId: "req-google",
    });
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.audits.at(-1)).toMatchObject({
      adminUserId: "admin-1",
      action: "admin.google_login",
      outcome: "success",
    });
    repository.user = null;
    const denied = await service.beginGoogleLogin();
    await expect(
      service.completeGoogleLogin({
        state: denied.state,
        cookieState: denied.state,
        code: "another-code",
        ip: "127.0.0.1",
        requestId: "req-google-denied",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
