import { config } from '../../config/index.js';
import { EchoLLMProvider } from './echo.provider.js';
import type { LLMProvider } from './llm-provider.js';
import { OpenAIProvider } from './openai.provider.js';

export function createLLMProvider(): LLMProvider {
  if (!config.openai.apiKey) {
    return new EchoLLMProvider();
  }

  return new OpenAIProvider(
    config.openai.apiKey,
    config.openai.model,
    config.openai.timeoutMs,
    config.openai.maxOutputTokens,
  );
}
