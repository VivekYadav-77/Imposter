import { describe, expect, it, vi } from "vitest";

import { GoogleOAuthProvider } from "../../src/modules/user-auth/google-oauth.js";

type Payload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  nonce?: string;
  iss?: string;
  name?: string;
};

function providerWith(payload: Payload | Error) {
  const provider = new GoogleOAuthProvider("web-client-id", "server-secret", "https://callback");
  const verifyIdToken =
    payload instanceof Error
      ? vi.fn().mockRejectedValue(payload)
      : vi.fn().mockResolvedValue({ getPayload: () => payload });
  Object.assign(provider as unknown as { client: unknown }, {
    client: { verifyIdToken },
  });
  return { provider, verifyIdToken };
}

const validPayload: Payload = {
  sub: "google-subject",
  email: "Player@Example.com",
  email_verified: true,
  nonce: "expected-nonce",
  iss: "https://accounts.google.com",
  name: "Player",
};

describe("native Google ID-token verification", () => {
  it("binds verification to the server web client ID and normalizes a valid identity", async () => {
    const { provider, verifyIdToken } = providerWith(validPayload);

    await expect(provider.verifyIdToken("signed-id-token", "expected-nonce")).resolves.toEqual({
      subject: "google-subject",
      email: "player@example.com",
      emailVerified: true,
      name: "Player",
    });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: "signed-id-token",
      audience: "web-client-id",
    });
  });

  it.each(["invalid signature", "wrong audience", "expired token"])(
    "maps a Google library %s rejection to a safe authentication error",
    async () => {
      const { provider } = providerWith(new Error("provider detail must not escape"));
      await expect(
        provider.verifyIdToken("untrusted-id-token", "expected-nonce"),
      ).rejects.toMatchObject({ status: 401, code: "GOOGLE_IDENTITY_INVALID" });
    },
  );

  it.each([
    ["wrong nonce", { ...validPayload, nonce: "other" }],
    ["wrong issuer", { ...validPayload, iss: "https://attacker.example" }],
    ["unverified email", { ...validPayload, email_verified: false }],
    ["missing subject", { ...validPayload, sub: undefined }],
  ])("rejects %s", async (_label, payload) => {
    const { provider } = providerWith(payload);
    await expect(provider.verifyIdToken("signed-id-token", "expected-nonce")).rejects.toMatchObject(
      { status: 401, code: "GOOGLE_IDENTITY_INVALID" },
    );
  });
});
