import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../src/core/llm/openai.provider.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('OpenAIProvider', () => {
  it('calls the Responses API with low reasoning effort and returns usage metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'resp_1',
          status: 'completed',
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

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200, 'low');

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

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options?.headers?.authorization).toBe('Bearer test-key');

    const body = JSON.parse(String(options?.body));
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input).toEqual([{ role: 'user', content: 'Привет' }]);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.max_output_tokens).toBe(1_200);
  });

  it('rejects incomplete responses even when partial text is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'Partial answer' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      }),
    ).rejects.toThrow(
      'OpenAI Responses API returned incomplete output: max_output_tokens',
    );
  });

  it('concatenates all output_text parts in response order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  { type: 'output_text', text: 'Первая часть.' },
                  { type: 'output_text', text: 'Вторая часть.' },
                ],
              },
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'Третья часть.' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      }),
    ).resolves.toMatchObject({
      text: 'Первая часть.\nВторая часть.\nТретья часть.',
      provider: 'openai',
    });
  });

  it('returns a valid refusal as user-facing output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'refusal',
                    refusal: 'Не могу помочь с этим запросом.',
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200);

    await expect(
      provider.generateReply({
        message: 'Запрос',
        conversationId: 'chat5',
      }),
    ).resolves.toMatchObject({
      text: 'Не могу помочь с этим запросом.',
      provider: 'openai',
    });
  });

  it('omits reasoning options when they are not configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'completed', output_text: 'OK' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider('test-key', 'gpt-4.1', 5_000, 1_200);

    await provider.generateReply({ message: 'Привет', conversationId: 'chat5' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.reasoning).toBeUndefined();
  });

  it('does not propagate provider error messages that may contain credential-derived data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'invalid_request_error',
              message: 'Incorrect API key provided: sk-proj-...ABCD',
            },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('secret-key', 'gpt-6-luna', 5_000, 1_200);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      }),
    ).rejects.toThrow('OpenAI Responses API error (HTTP 400, code invalid_request_error)');
  });
});
