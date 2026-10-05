export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface IntegrationStorage {
  getBotId(): Promise<number | null>;
  setBotId(id: number | null): Promise<void>;
  getTokens(): Promise<AuthTokens | null>;
  saveTokens(tokens: AuthTokens | null): Promise<void>;
}
