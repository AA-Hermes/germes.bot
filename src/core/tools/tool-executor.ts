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

    const startedAt = performance.now();

    try {
      const output = await tool.execute(call.input, context);

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
      this.logger.error({
        event: 'TOOL_EXECUTION_ERROR',
        tool: call.name,
        risk: tool.definition.risk,
        channel: context.channel,
        conversationId: context.conversationId,
        latencyMs: Math.round(performance.now() - startedAt),
        err: error,
      });

      if (error instanceof ToolError) throw error;
      throw new ToolError('Tool execution failed', 'execution_failed', call.name, {
        cause: error,
      });
    }
  }
}
