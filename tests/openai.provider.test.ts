import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../src/core/llm/openai.provider.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('OpenAIProvider', () => {
  it('calls the Responses API and returns text with usage metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'resp_1',
          model: 'gpt-6-luna',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Здравствуйте! Чем могу помочь?',
                },
              ],
            },
          ],
          usage: {
            input_tokens: 12,
            output_tokens: 8,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 500);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
        userId: '1',
      }),
    ).resolves.toEqual({
      text: 'Здравствуйте! Чем могу помочь?',
      provider: 'openai',
      model: 'gpt-6-luna',
      inputTokens: 12,
      outputTokens: 8,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options?.headers?.authorization).toBe('Bearer test-key');

    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input).toEqual([{ role: 'user', content: 'Привет' }]);
    expect(body.max_output_tokens).toBe(500);
  });

  it('throws without exposing the API key when OpenAI returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'invalid_request_error',
              message: 'Invalid request',
            },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('secret-key', 'gpt-6-luna', 5_000, 500);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      }),
    ).rejects.toThrow('Invalid request');
  });
});
