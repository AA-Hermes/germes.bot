import type { FastifyBaseLogger } from 'fastify';
import type { AuthTokens, IntegrationStorage } from '../../../storage/integration-storage.js';

interface OAuthRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  domain?: string;
  error?: string;
  error_description?: string;
}

export class Bitrix24OAuthService {
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(
    private readonly storage: IntegrationStorage,
    private readonly clientId: string | null,
    private readonly clientSecret: string | null,
    private readonly logger: FastifyBaseLogger,
  ) {}

  private requireCredentials(): { clientId: string; clientSecret: string } {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Bitrix24 OAuth client credentials are not configured');
    }

    return { clientId: this.clientId, clientSecret: this.clientSecret };
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.storage.getTokens();
    if (!tokens?.accessToken) throw new Error('Bitrix24 application is not installed');
    return tokens.accessToken;
  }

  async refreshTokens(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<AuthTokens> {
    const credentials = this.requireCredentials();
    const current = await this.storage.getTokens();

    if (!current?.refreshToken) {
      throw new Error('Bitrix24 refresh token is not available');
    }

    const oauthServer = current.oauthServer || 'oauth.bitrix.info';
    const url = new URL('/oauth/token/', `https://${oauthServer}`);
    url.searchParams.set('grant_type', 'refresh_token');
    url.searchParams.set('client_id', credentials.clientId);
    url.searchParams.set('client_secret', credentials.clientSecret);
    url.searchParams.set('refresh_token', current.refreshToken);

    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    const payload = (await response.json()) as OAuthRefreshResponse;

    if (!response.ok || payload.error || !payload.access_token || !payload.refresh_token) {
      this.logger.error({
        event: 'B24_OAUTH_REFRESH_ERROR',
        status: response.status,
        code: payload.error,
      });

      throw new Error(payload.error_description || 'Bitrix24 OAuth token refresh failed');
    }

    const expiresIn = Number(payload.expires_in ?? 3600);
    const tokens: AuthTokens = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + Math.max(expiresIn, 0) * 1000,
      oauthServer: payload.domain || oauthServer,
    };

    await this.storage.saveTokens(tokens);

    this.logger.info({ event: 'B24_OAUTH_REFRESHED' });

    return tokens;
  }
}
