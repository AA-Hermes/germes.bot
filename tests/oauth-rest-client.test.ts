import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type {
  AuthTokens,
  Bitrix24Installation,
  IntegrationStorage,
} from '../src/storage/integration-storage.js';
import { Bitrix24OAuthService } from '../src/modules/bitrix24/services/oauth.service.js';
import { Bitrix24RestClient } from '../src/modules/bitrix24/services/rest-client.service.js';

class MemoryStorage implements IntegrationStorage {
  botId: number | null = null;
  tokens: AuthTokens | null = {
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    oauthServer: 'oauth.bitrix.info',
  };
  installation: Bitrix24Installation | null = {
    domain: 'example.bitrix24.com',
    memberId: 'member',
    clientEndpoint: 'https://example.bitrix24.com/rest/',
    serverEndpoint: 'https://oauth.bitrix.info/rest/',
    scope: 'imbot',
    applicationToken: 'app-token',
  };

  async getBotId() { return this.botId; }
  async setBotId(id: number | null) { this.botId = id; }
  async getTokens() { return this.tokens; }
  async saveTokens(tokens: AuthTokens | null) { this.tokens = tokens; }
  async getBitrix24Installation() { return this.installation; }
  async saveBitrix24Installation(installation: Bitrix24Installation | null) {
    this.installation = installation;
  }
}

const logger = {
  info: vi.fn(),
  error: vi.fn(),
} as unknown as FastifyBaseLogger;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Bitrix24 OAuth REST client', () => {
  it('refreshes an expired access token and retries the REST call once', async () => {
    const storage = new MemoryStorage();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'expired_token',
            error_description: 'The access token expired',
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'fresh-access',
            refresh_token: 'refresh-2',
            expires_in: 3600,
            domain: 'oauth.bitrix.info',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { ok: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const oauth = new Bitrix24OAuthService(storage, 'client-id', 'client-secret', logger);
    const client = new Bitrix24RestClient(storage, oauth, logger);

    await expect(client.call<{ ok: boolean }>('imbot.v2.Revision.get', {})).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(storage.tokens?.accessToken).toBe('fresh-access');
    expect(storage.tokens?.refreshToken).toBe('refresh-2');

    const retryBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(retryBody.auth).toBe('fresh-access');
  });
});
