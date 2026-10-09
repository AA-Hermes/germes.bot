import type { FastifyBaseLogger } from 'fastify';
import type { ToolContext } from './tool.js';
import { ToolError } from './tool-errors.js';
import { ToolRegistry } from './tool-registry.js';

export interface ToolCall {
  name: string;
  input: unknown;
}

export interface ToolExecutionResult {
  name: string;
  output: unknown;
}

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly logger: FastifyBaseLogger,
  ) {}

  definitions() {
    return this.registry.list();
  }

  async execute(call: ToolCall, context: ToolContext): Promise<ToolExecutionResult> {
    const tool = this.registry.get(call.name);

    if (tool.definition.risk === 'write') {
      throw new ToolError(
        `Write tool requires an explicit execution policy: ${call.name}`,
        'execution_failed',
        call.name,
      );
    }

    let input: unknown;
    try {
      input = tool.parseInput(call.input);
    } catch {
      throw new ToolError('Invalid tool input', 'invalid_input', call.name);
    }

    const startedAt = performance.now();

    try {
      const output = await tool.execute(input, context);

      this.logger.info({
        event: 'TOOL_EXECUTION_COMPLETED',
        tool: call.name,
        risk: tool.definition.risk,
        channel: context.channel,
        conversationId: context.conversationId,
        latencyMs: Math.round(performance.now() - startedAt),
      });

      return { name: call.name, output };
    } catch (error) {
      const kind = error instanceof ToolError ? error.kind : 'execution_failed';

      this.logger.error({
        event: 'TOOL_EXECUTION_ERROR',
        tool: call.name,
        risk: tool.definition.risk,
        channel: context.channel,
        conversationId: context.conversationId,
        latencyMs: Math.round(performance.now() - startedAt),
        errorKind: kind,
      });

      if (error instanceof ToolError) {
        throw new ToolError('Tool execution failed', error.kind, call.name);
      }
      throw new ToolError('Tool execution failed', 'execution_failed', call.name);
    }
  }
}
