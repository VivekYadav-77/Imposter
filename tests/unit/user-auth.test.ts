import { describe, expect, it } from "vitest";
import {
  registerUserSchema,
  loginUserSchema,
  changePasswordSchema,
} from "../../src/modules/user-auth/schemas.js";
import {
  USER_COOKIE_NAME,
  userSessionCookie,
  clearUserSessionCookie,
} from "../../src/shared/security/cookies.js";

describe("player account boundaries", () => {
  it("normalizes email and validates account inputs", () => {
    expect(
      registerUserSchema.parse({
        email: " Ada@Example.COM ",
        password: "correct horse battery",
        displayName: "Ada",
        avatarId: "fox",
      }).email,
    ).toBe("ada@example.com");
    expect(() =>
      registerUserSchema.parse({
        email: "a@example.com",
        password: "short",
        displayName: "Ada",
        avatarId: "fox",
      }),
    ).toThrow();
    expect(
      loginUserSchema.safeParse({ email: "a@example.com", password: "anything" }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "also long enough" })
        .success,
    ).toBe(true);
  });
  it("uses an independent hardened account cookie", () => {
    expect(USER_COOKIE_NAME).toBe("__Host-user_session");
    expect(userSessionCookie("secret", 60)).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(clearUserSessionCookie()).toContain("Max-Age=0");
  });
});
