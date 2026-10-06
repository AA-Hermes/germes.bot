export type LLMProviderErrorKind =
  | 'quota_exhausted'
  | 'authentication_failed'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error';

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: LLMProviderErrorKind,
    public readonly provider: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
