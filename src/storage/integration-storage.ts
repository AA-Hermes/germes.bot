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

export interface Bitrix24CredentialsSnapshot {
  tokens: AuthTokens | null;
  installation: Bitrix24Installation | null;
}

export interface IntegrationStorage {
  getCredentialsSnapshot(): Promise<Bitrix24CredentialsSnapshot>;
  saveCredentialsSnapshot(snapshot: Bitrix24CredentialsSnapshot): Promise<void>;
  saveTokensIfUnchanged(tokens: AuthTokens, previous: Bitrix24CredentialsSnapshot): Promise<boolean>;
  getBotId(): Promise<number | null>;
  setBotId(id: number | null): Promise<void>;
  getTokens(): Promise<AuthTokens | null>;
  saveTokens(tokens: AuthTokens | null): Promise<void>;
  getBitrix24Installation(): Promise<Bitrix24Installation | null>;
  saveBitrix24Installation(installation: Bitrix24Installation | null): Promise<void>;
}
