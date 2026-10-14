import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLMProviderError } from '../src/core/llm/llm-provider-error.js';
import { OpenAIProvider } from '../src/core/llm/openai.provider.js';
import type { ToolExecutor } from '../src/core/tools/tool-executor.js';

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

  it('sanitizes non-JSON error responses without exposing the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('gateway authentication failure', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    );

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200);

    await expect(
      provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      }),
    ).rejects.toThrow('OpenAI Responses API error (HTTP 502, code unknown)');
  });

  it.each([
    'credit_balance_exhausted',
    'insufficient_quota',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
  ])('classifies %s as a quota error', async (code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code,
              message: 'Billing or quota limit reached',
            },
          }),
          {
            status: 429,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const provider = new OpenAIProvider('test-key', 'gpt-6-luna', 5_000, 1_200);

    try {
      await provider.generateReply({
        message: 'Привет',
        conversationId: 'chat5',
      });
      throw new Error('Expected provider to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(LLMProviderError);
      expect(error).toMatchObject({
        kind: 'quota_exhausted',
        provider: 'openai',
        status: 429,
        code,
      });
    }
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
  it('uses the workflow channel rather than model-authored tool arguments', async () => {
    const execute = vi.fn().mockResolvedValue({ name: 'crm_search_deals', output: [] });
    const executor = {
      definitions: () => [{ name: 'crm_search_deals', description: 'Search deals', inputSchema: { type: 'object', properties: {} }, risk: 'read' }],
      execute,
    } as unknown as ToolExecutor;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        output: [{ type: 'function_call', name: 'crm_search_deals', call_id: 'call_1', arguments: '{"channel":"attacker"}' }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed', output_text: 'Done',
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIProvider('key', 'gpt-4.1', 5000, 1200, null, executor);
    await provider.generateReply({ message: 'Find deals', channel: 'telegram', conversationId: 'chat-1', userId: 'u1' });
    expect(execute).toHaveBeenCalledWith(
      { name: 'crm_search_deals', input: { channel: 'attacker' } },
      { channel: 'telegram', conversationId: 'chat-1', userId: 'u1' },
    );
  });


  it('does not advertise CRM tools when request authorization is denied', async () => {
    const execute = vi.fn();
    const executor = {
      definitions: () => [{ name: 'crm_search_deals', description: 'Search deals', inputSchema: { type: 'object', properties: {} }, risk: 'read' }],
      execute,
    } as unknown as ToolExecutor;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed', output_text: 'No tools available',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIProvider('key', 'gpt-4.1', 5000, 1200, null, executor, () => false);
    await provider.generateReply({ message: 'Search CRM', channel: 'bitrix24', conversationId: 'chat-2', userId: 'other' });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.tools).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });


  it('does not start another tool call after the response deadline', async () => {
    const execute = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { name: 'crm_search_deals', output: [] };
    });
    const executor = {
      definitions: () => [{ name: 'crm_search_deals', description: 'Search deals', inputSchema: { type: 'object', properties: {} }, risk: 'read' }],
      execute,
    } as unknown as ToolExecutor;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'completed',
      output: [
        { type: 'function_call', name: 'crm_search_deals', call_id: 'one', arguments: '{}' },
        { type: 'function_call', name: 'crm_search_deals', call_id: 'two', arguments: '{}' },
      ],
    }), { status: 200 })));
    const provider = new OpenAIProvider('key', 'gpt-4.1', 10, 1200, null, executor);
    await expect(provider.generateReply({ message: 'Search', channel: 'bitrix24', conversationId: 'c' }))
      .rejects.toMatchObject({ kind: 'timeout' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

});
