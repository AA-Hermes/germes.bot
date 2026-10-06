import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('OpenAI configuration', () => {
  it('rejects max output token values below the Responses API minimum', async () => {
    vi.stubEnv('OPENAI_MAX_OUTPUT_TOKENS', '15');

    await expect(import('../src/config/index.js')).rejects.toThrow();
  });

  it('accepts the minimum max output token value', async () => {
    vi.stubEnv('OPENAI_MAX_OUTPUT_TOKENS', '16');

    const { config } = await import('../src/config/index.js');

    expect(config.openai.maxOutputTokens).toBe(16);
  });
});
