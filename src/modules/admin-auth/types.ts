export interface AdminPrincipal {
  adminUserId: string;
  email: string;
  sessionId: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  status: "active" | "disabled";
}

export interface AdminAccountSummary {
  id: string;
  email: string;
  displayName: string;
  avatarId: string;
  status: "active" | "disabled";
  createdAt: string;
  lastActiveAt: string | null;
  gamesPlayed: number;
}

export interface AuditEvent {
  adminUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  ipHash?: string;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
}

export interface AdminAuthRepository {
  findUserByEmail(email: string): Promise<AdminUserRecord | null>;
  createSession(input: {
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: Date;
    ipHash: string | null;
  }): Promise<void>;
  resolveSession(tokenHash: string, now: Date): Promise<AdminPrincipal | null>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
  touchSuccessfulLogin(adminUserId: string, now: Date): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<number>;
  audit(event: AuditEvent): Promise<void>;
  createGoogleTransaction?(input: {
    stateHash: string;
    nonce: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeGoogleTransaction?(stateHash: string, now: Date): Promise<{ nonce: string } | null>;
  listUserAccounts?(): Promise<AdminAccountSummary[]>;
}
