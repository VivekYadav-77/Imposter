import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "../../src/modules/user-auth/schemas.js";
import {
  OAUTH_COOKIE_NAME,
  USER_COOKIE_NAME,
  oauthTransactionCookie,
  userSessionCookie,
  clearUserSessionCookie,
} from "../../src/shared/security/cookies.js";

describe("player account boundaries", () => {
  it("validates editable profile inputs", () => {
    expect(updateProfileSchema.parse({ displayName: " Ada ", avatarId: "fox" })).toEqual({
      displayName: "Ada",
      avatarId: "fox",
    });
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
  it("uses an independent hardened account cookie", () => {
    expect(USER_COOKIE_NAME).toBe("__Host-user_session");
    expect(userSessionCookie("secret", 60)).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(clearUserSessionCookie()).toContain("Max-Age=0");
    expect(OAUTH_COOKIE_NAME).toBe("__Host-oauth_transaction");
    expect(oauthTransactionCookie("state")).toContain("HttpOnly; Secure; SameSite=Lax");
  });
});
