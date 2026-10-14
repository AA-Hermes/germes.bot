import { config } from '../../config/index.js';
import { EchoLLMProvider } from './echo.provider.js';
import type { LLMProvider } from './llm-provider.js';
import { OpenAIProvider } from './openai.provider.js';
import type { ToolExecutor } from '../tools/tool-executor.js';
import type { LLMGenerateInput } from './llm-provider.js';

export function createLLMProvider(toolExecutor?: ToolExecutor, canUseTools?: (input: LLMGenerateInput) => boolean): LLMProvider {
  if (!config.openai.apiKey) {
    return new EchoLLMProvider();
  }

  const reasoningEffort =
    config.openai.reasoningEffort ??
    (config.openai.model === 'gpt-6-luna' ? 'low' : null);

  return new OpenAIProvider(
    config.openai.apiKey,
    config.openai.model,
    config.openai.timeoutMs,
    config.openai.maxOutputTokens,
    reasoningEffort,
    toolExecutor,
    canUseTools,
  );
}
