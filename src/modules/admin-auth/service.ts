import { randomUUID } from "node:crypto";

import { ApplicationError } from "../../shared/errors/application-error.js";
import { verifyPassword } from "../../shared/security/password.js";
import { createOpaqueToken, hashSecret } from "../../shared/security/tokens.js";
import type { LoginThrottle } from "./throttle.js";
import type { AdminAuthRepository, AdminPrincipal } from "./types.js";

const DUMMY_PASSWORD_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

export class AdminAuthService {
  constructor(
    private readonly repository: AdminAuthRepository,
    private readonly throttle: LoginThrottle,
    private readonly pepper: string,
    private readonly sessionTtlSeconds: number,
  ) {}

  async login(input: {
    email: string;
    password: string;
    ip: string;
    requestId: string;
  }): Promise<{ token: string; maxAgeSeconds: number }> {
    await this.repository.deleteExpiredSessions(new Date());
    const email = input.email.trim().toLowerCase();
    const ipHash = hashSecret(input.ip, this.pepper);
    const throttleKey = hashSecret(`${email}:${input.ip}`, this.pepper);
    const status = this.throttle.check(throttleKey);
    if (!status.allowed) {
      await this.repository.audit({
        action: "admin.login",
        ipHash,
        outcome: "failure",
        requestId: input.requestId,
        metadata: { reason: "rate_limited" },
      });
      throw new ApplicationError(429, "RATE_LIMITED", "Too many login attempts. Try again later.", {
        retryAfterSeconds: status.retryAfterSeconds,
      });
    }
    const user = await this.repository.findUserByEmail(email);
    const passwordValid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const valid = user?.status === "active" && passwordValid;
    if (!valid || !user) {
      this.throttle.recordFailure(throttleKey);
      await this.repository.audit({
        adminUserId: user?.id,
        action: "admin.login",
        ipHash,
        outcome: "failure",
        requestId: input.requestId,
        metadata: { reason: "invalid_credentials" },
      });
      throw new ApplicationError(401, "INVALID_CREDENTIALS", "The email or password is invalid.");
    }
    this.throttle.clear(throttleKey);
    const token = createOpaqueToken();
    const now = new Date();
    await this.repository.createSession({
      id: randomUUID(),
      adminUserId: user.id,
      tokenHash: hashSecret(token, this.pepper),
      expiresAt: new Date(now.getTime() + this.sessionTtlSeconds * 1000),
      ipHash,
    });
    await this.repository.touchSuccessfulLogin(user.id, now);
    await this.repository.audit({
      adminUserId: user.id,
      action: "admin.login",
      ipHash,
      outcome: "success",
      requestId: input.requestId,
    });
    return { token, maxAgeSeconds: this.sessionTtlSeconds };
  }

  async authenticate(token: string | null): Promise<AdminPrincipal> {
    if (!token)
      throw new ApplicationError(
        401,
        "SESSION_INVALID",
        "An active administrator session is required.",
      );
    const principal = await this.repository.resolveSession(
      hashSecret(token, this.pepper),
      new Date(),
    );
    if (!principal)
      throw new ApplicationError(
        401,
        "SESSION_INVALID",
        "An active administrator session is required.",
      );
    return principal;
  }

  async logout(principal: AdminPrincipal, requestId: string): Promise<void> {
    await this.repository.revokeSession(principal.sessionId, new Date());
    await this.repository.audit({
      adminUserId: principal.adminUserId,
      action: "admin.logout",
      outcome: "success",
      requestId,
    });
  }
}
