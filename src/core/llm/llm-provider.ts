export interface LLMGenerateInput {
  message: string;
  channel?: string;
  conversationId: string;
  userId?: string;
}

export interface LLMGenerateResult {
  text: string;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMProvider {
  generateReply(input: LLMGenerateInput): Promise<LLMGenerateResult>;
}
