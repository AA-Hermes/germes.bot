export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  oauthServer?: string;
}

export interface Bitrix24Installation {
  domain: string;
  memberId: string;
  clientEndpoint: string;
  serverEndpoint: string;
  scope: string;
  applicationToken: string;
}

export interface IntegrationStorage {
  getBotId(): Promise<number | null>;
  setBotId(id: number | null): Promise<void>;
  getTokens(): Promise<AuthTokens | null>;
  saveTokens(tokens: AuthTokens | null): Promise<void>;
  getBitrix24Installation(): Promise<Bitrix24Installation | null>;
  saveBitrix24Installation(installation: Bitrix24Installation | null): Promise<void>;
}
