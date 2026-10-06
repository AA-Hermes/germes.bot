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

type ReasoningEffort = 'low' | 'medium' | 'high';

function safeErrorCode(code: string | undefined): string {
  if (!code) return 'unknown';
  return /^[a-zA-Z0-9_.-]+$/.test(code) ? code : 'unknown';
}

export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxOutputTokens: number,
    private readonly reasoningEffort: ReasoningEffort | null = null,
  ) {}

  async generateReply(input: LLMGenerateInput): Promise<LLMGenerateResult> {
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

      const payload = (await response.json()) as OpenAIResponsePayload;

      if (!response.ok || payload.error) {
        throw new Error(
          `OpenAI Responses API error (HTTP ${response.status}, code ${safeErrorCode(payload.error?.code)})`,
        );
      }

      if (payload.status === 'incomplete') {
        const reason = payload.incomplete_details?.reason ?? 'unknown';
        throw new Error(`OpenAI Responses API returned incomplete output: ${reason}`);
      }

      const text = this.extractText(payload);

      if (!text) {
        throw new Error('OpenAI Responses API returned no user-facing output');
      }

      return {
        text,
        provider: 'openai',
        model: payload.model || this.model,
        inputTokens: payload.usage?.input_tokens,
        outputTokens: payload.usage?.output_tokens,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI Responses API request timed out');
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
