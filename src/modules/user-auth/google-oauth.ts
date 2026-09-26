import { OAuth2Client } from "google-auth-library";
import type { AppConfig } from "../../infrastructure/configuration/config.js";
import { ApplicationError } from "../../shared/errors/application-error.js";

export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleIdentityProvider {
  authorizationUrl(input: { state: string; nonce: string }): string;
  exchange(code: string, nonce: string): Promise<GoogleIdentity>;
}

export class GoogleOAuthProvider implements GoogleIdentityProvider {
  private readonly client: OAuth2Client;

  constructor(
    private readonly clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  authorizationUrl(input: { state: string; nonce: string }): string {
    return this.client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state: input.state,
      nonce: input.nonce,
      prompt: "select_account",
    });
  }

  async exchange(code: string, nonce: string): Promise<GoogleIdentity> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token)
      throw new ApplicationError(
        401,
        "GOOGLE_IDENTITY_MISSING",
        "Google did not return an identity token.",
      );
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      payload.nonce !== nonce ||
      !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")
    )
      throw new ApplicationError(
        401,
        "GOOGLE_IDENTITY_INVALID",
        "Google could not verify this account. Please try again.",
      );
    return {
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name: payload.name?.trim() || null,
    };
  }
}

export function createGoogleIdentityProvider(config: AppConfig): GoogleIdentityProvider | null {
  if (
    !config.googleOAuthClientId ||
    !config.googleOAuthClientSecret ||
    !config.googleOAuthRedirectUri
  )
    return null;
  return new GoogleOAuthProvider(
    config.googleOAuthClientId,
    config.googleOAuthClientSecret,
    config.googleOAuthRedirectUri,
  );
}
