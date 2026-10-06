import type {
  LLMGenerateInput,
  LLMGenerateResult,
  LLMProvider,
} from './llm-provider.js';

export class EchoLLMProvider implements LLMProvider {
  async generateReply(input: LLMGenerateInput): Promise<LLMGenerateResult> {
    return {
      text: `Получил: ${input.message}`,
      provider: 'echo',
      model: 'echo',
    };
  }
}
