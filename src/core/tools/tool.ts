export type ToolRisk = 'read' | 'write';

export interface ToolContext {
  channel: string;
  conversationId: string;
  userId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: ToolRisk;
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  definition: ToolDefinition;
  parseInput(input: unknown): TInput;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}
