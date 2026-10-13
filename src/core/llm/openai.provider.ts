import { LLMProviderError, type LLMProviderErrorKind } from './llm-provider-error.js';
import type { ToolExecutor } from '../tools/tool-executor.js';
import type {
  LLMGenerateInput,
  LLMGenerateResult,
  LLMProvider,
} from './llm-provider.js';

interface OpenAIResponseContent {
  type?: string;
  text?: string;
  refusal?: string;
}

interface OpenAIResponseOutput {
  type?: string;
  content?: OpenAIResponseContent[];
  name?: string;
  call_id?: string;
  arguments?: string;
}

interface OpenAIResponsePayload {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output_text?: string;
  output?: OpenAIResponseOutput[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

type ReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

function safeErrorCode(code: string | undefined): string {
  if (!code) return 'unknown';
  return /^[a-zA-Z0-9_.-]+$/.test(code) ? code : 'unknown';
}

function mapErrorKind(status: number, code: string): LLMProviderErrorKind {
  if (
    [
      'credit_balance_exhausted',
      'insufficient_quota',
      'organization_spend_limit_exceeded',
      'project_spend_limit_exceeded',
      'organization_usage_limit_exceeded',
    ].includes(code)
  ) {
    return 'quota_exhausted';
  }

  if (status === 401 || code === 'invalid_api_key') {
    return 'authentication_failed';
  }

  if (status === 429) {
    return 'rate_limited';
  }

  return 'provider_error';
}

function createProviderError(status: number, code?: string): LLMProviderError {
  const safeCode = safeErrorCode(code);

  return new LLMProviderError(
    `OpenAI Responses API error (HTTP ${status}, code ${safeCode})`,
    mapErrorKind(status, safeCode),
    'openai',
    status,
    safeCode,
  );
}

export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxOutputTokens: number,
    private readonly reasoningEffort: ReasoningEffort | null = null,
    private readonly toolExecutor?: ToolExecutor,
  ) {}

  async generateReply(input: LLMGenerateInput): Promise<LLMGenerateResult> {
    const inputConversationId = input.conversationId;
    const inputUserId = input.userId;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const requestBody: Record<string, unknown> = {
        model: this.model,
        instructions:
          'You are Hermes AI, a concise business assistant. Reply in the language used by the user unless they ask for another language.',
        input: [
          {
            role: 'user',
            content: input.message,
          },
        ],
        max_output_tokens: this.maxOutputTokens,
      };

      if (this.reasoningEffort) {
        requestBody.reasoning = {
          effort: this.reasoningEffort,
        };
      }

      const available = this.toolExecutor?.definitions().filter((tool) => tool.risk === 'read') ?? [];
      if (available.length) requestBody.tools = available.map((tool) => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.inputSchema, strict: false }));
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let inputUsageComplete = true;
      let outputUsageComplete = true;
      let toolCallsUsed = 0;
      for (let turn = 0; turn < 4; turn++) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      let payload: OpenAIResponsePayload = {};

      try {
        payload = (await response.json()) as OpenAIResponsePayload;
      } catch {
        if (!response.ok) {
          throw createProviderError(response.status);
        }

        throw new Error('OpenAI Responses API returned invalid JSON');
      }

      if (!response.ok || payload.error) {
        throw createProviderError(response.status, payload.error?.code);
      }

      if (payload.status === 'incomplete') {
        const reason = payload.incomplete_details?.reason ?? 'unknown';
        throw new Error(`OpenAI Responses API returned incomplete output: ${reason}`);
      }

      if (typeof payload.usage?.input_tokens === 'number') totalInputTokens += payload.usage.input_tokens;
      else inputUsageComplete = false;
      if (typeof payload.usage?.output_tokens === 'number') totalOutputTokens += payload.usage.output_tokens;
      else outputUsageComplete = false;
      const calls = (payload.output ?? []).filter((item) => item.type === 'function_call');
      if (calls.length) {
        if (!this.toolExecutor || turn === 3) throw new Error('OpenAI tool execution unavailable');
        if (toolCallsUsed + calls.length > 6) throw new Error('OpenAI tool call budget exceeded');
        toolCallsUsed += calls.length;
        const outputs = [];
        for (const call of calls) {
          if (!call.call_id || !call.name || !call.arguments) throw new Error('Invalid function call');
          let input: unknown;
          try { input = JSON.parse(call.arguments); } catch { input = null; }
          let output: unknown;
          try { output = (await this.toolExecutor.execute({ name: call.name, input }, { channel: input.channel ?? 'unknown', conversationId: inputConversationId, userId: inputUserId })).output; }
          catch { output = { error: 'Tool execution failed' }; }
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) });
        }
        requestBody.input = [...(requestBody.input as unknown[]), ...(payload.output ?? []), ...outputs];
        continue;
      }
      const text = this.extractText(payload);

      if (!text) {
        throw new Error('OpenAI Responses API returned no user-facing output');
      }

      return {
        text,
        provider: 'openai',
        model: payload.model || this.model,
        inputTokens: inputUsageComplete ? totalInputTokens : undefined,
        outputTokens: outputUsageComplete ? totalOutputTokens : undefined,
      };
      }
      throw new Error('OpenAI tool iteration limit exceeded');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMProviderError(
          'OpenAI Responses API request timed out',
          'timeout',
          'openai',
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractText(payload: OpenAIResponsePayload): string | null {
    const parts: string[] = [];

    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      parts.push(payload.output_text.trim());
    } else {
      for (const item of payload.output ?? []) {
        for (const content of item.content ?? []) {
          if (content.type === 'output_text' && typeof content.text === 'string') {
            const text = content.text.trim();
            if (text) parts.push(text);
          }

          if (content.type === 'refusal' && typeof content.refusal === 'string') {
            const refusal = content.refusal.trim();
            if (refusal) parts.push(refusal);
          }
        }
      }
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }
}
