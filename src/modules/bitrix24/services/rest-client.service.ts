import type { FastifyBaseLogger } from 'fastify';

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
    private readonly baseUrl: string,
    private readonly logger: FastifyBaseLogger,
    private readonly timeoutMs = 10_000,
  ) {}

  async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!this.baseUrl) throw new Bitrix24RestError('Bitrix24 webhook URL is not configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(method, this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      const payload = (await response.json()) as BitrixResponse<T>;

      if (!response.ok) {
        this.logger.error({ event: 'BITRIX_API_REQUEST_ERROR', method, status: response.status });
        throw new Bitrix24RestError('Bitrix24 HTTP error', payload.error, response.status);
      }

      if (payload.error) {
        this.logger.error({ event: 'BITRIX_API_REQUEST_ERROR', method, code: payload.error });
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
      if ((error as Error).name === 'AbortError') {
        throw new Bitrix24RestError('Bitrix24 request timed out');
      }
      throw new Bitrix24RestError((error as Error).message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
