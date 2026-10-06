import type { FastifyBaseLogger } from 'fastify';
import type { IntegrationStorage } from '../../../storage/integration-storage.js';
import { Bitrix24OAuthService } from './oauth.service.js';

interface BitrixResponse<T> {
  result?: T;
  error?: string;
  error_description?: string;
}

export class Bitrix24RestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'Bitrix24RestError';
  }
}

export class Bitrix24RestClient {
  constructor(
    private readonly storage: IntegrationStorage,
    private readonly oauth: Bitrix24OAuthService,
    private readonly logger: FastifyBaseLogger,
    private readonly timeoutMs = 10_000,
  ) {}

  async prepareCall(): Promise<{ clientEndpoint: string; accessToken: string }> {
    const tokens = await this.storage.getTokens();
    const installation = await this.storage.getBitrix24Installation();

    if (!tokens?.accessToken || !installation?.clientEndpoint) {
      throw new Bitrix24RestError('Bitrix24 application is not installed');
    }

    return {
      clientEndpoint: installation.clientEndpoint,
      accessToken: tokens.accessToken,
    };
  }

  async callPrepared<T>(
    prepared: { clientEndpoint: string; accessToken: string },
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await this.callWithToken<T>(
        prepared.clientEndpoint,
        method,
        params,
        prepared.accessToken,
      );
    } catch (error) {
      if (!(error instanceof Bitrix24RestError) || error.code !== 'expired_token') {
        throw error;
      }

      const refreshed = await this.oauth.refreshTokens();

      return this.callWithToken<T>(
        prepared.clientEndpoint,
        method,
        params,
        refreshed.accessToken,
      );
    }
  }

  async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const prepared = await this.prepareCall();
    return this.callPrepared<T>(prepared, method, params);
  }

  private async callWithToken<T>(
    baseUrl: string,
    method: string,
    params: Record<string, unknown>,
    accessToken: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(method, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...params, auth: accessToken }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as BitrixResponse<T>;

      if (!response.ok || payload.error) {
        this.logger.error({
          event: 'BITRIX_API_REQUEST_ERROR',
          method,
          status: response.status,
          code: payload.error,
        });

        throw new Bitrix24RestError(
          payload.error_description || 'Bitrix24 REST error',
          payload.error,
          response.status,
        );
      }

      if (payload.result === undefined) {
        throw new Bitrix24RestError('Bitrix24 response does not contain result');
      }

      return payload.result;
    } catch (error) {
      if (error instanceof Bitrix24RestError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Bitrix24RestError('Bitrix24 request timed out');
      }

      throw new Bitrix24RestError(
        error instanceof Error ? error.message : 'Unknown Bitrix24 REST error',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
