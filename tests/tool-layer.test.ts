import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '../src/core/tools/tool-errors.js';
import { ToolExecutor } from '../src/core/tools/tool-executor.js';
import { ToolRegistry } from '../src/core/tools/tool-registry.js';
import type { Tool } from '../src/core/tools/tool.js';

function createLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

const context = {
  channel: 'bitrix24',
  conversationId: 'chat5',
  userId: '42',
};

describe('ToolRegistry', () => {
  it('registers and lists allowlisted tools', () => {
    const tool: Tool = {
      definition: {
        name: 'echo_tool',
        description: 'Echoes input for infrastructure tests',
        inputSchema: { type: 'object' },
        risk: 'read',
      },
      execute: vi.fn(async (input) => input),
    };

    const registry = new ToolRegistry([tool]);

    expect(registry.get('echo_tool')).toBe(tool);
    expect(registry.list()).toEqual([tool.definition]);
    expect(() => registry.get('missing_tool')).toThrow(ToolError);
  });

  it('rejects duplicate and invalid tool names', () => {
    const tool: Tool = {
      definition: {
        name: 'echo_tool',
        description: 'Echoes input',
        inputSchema: { type: 'object' },
        risk: 'read',
      },
      execute: vi.fn(),
    };

    const registry = new ToolRegistry([tool]);

    expect(() => registry.register(tool)).toThrow('Tool is already registered');
    expect(
      () =>
        registry.register({
          ...tool,
          definition: { ...tool.definition, name: 'Bad Tool' },
        }),
    ).toThrow('Invalid tool name');
  });
});

describe('ToolExecutor', () => {
  it('executes a read tool with channel-independent context', async () => {
    const execute = vi.fn(async (input) => ({ echoed: input }));
    const registry = new ToolRegistry([
      {
        definition: {
          name: 'echo_tool',
          description: 'Echoes input',
          inputSchema: { type: 'object' },
          risk: 'read',
        },
        execute,
      },
    ]);
    const logger = createLogger();
    const executor = new ToolExecutor(registry, logger);

    await expect(
      executor.execute({ name: 'echo_tool', input: { value: 'OPENAI' } }, context),
    ).resolves.toEqual({
      name: 'echo_tool',
      output: { echoed: { value: 'OPENAI' } },
    });

    expect(execute).toHaveBeenCalledWith({ value: 'OPENAI' }, context);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TOOL_EXECUTION_COMPLETED',
        tool: 'echo_tool',
        risk: 'read',
      }),
    );
  });

  it('blocks write tools until an explicit execution policy exists', async () => {
    const execute = vi.fn();
    const executor = new ToolExecutor(
      new ToolRegistry([
        {
          definition: {
            name: 'crm_update_deal',
            description: 'Updates a deal',
            inputSchema: { type: 'object' },
            risk: 'write',
          },
          execute,
        },
      ]),
      createLogger(),
    );

    await expect(
      executor.execute({ name: 'crm_update_deal', input: {} }, context),
    ).rejects.toMatchObject({
      name: 'ToolError',
      kind: 'execution_failed',
      toolName: 'crm_update_deal',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not leak underlying execution errors to callers', async () => {
    const executor = new ToolExecutor(
      new ToolRegistry([
        {
          definition: {
            name: 'failing_tool',
            description: 'Fails',
            inputSchema: { type: 'object' },
            risk: 'read',
          },
          execute: vi.fn(async () => {
            throw new Error('secret upstream details');
          }),
        },
      ]),
      createLogger(),
    );

    await expect(
      executor.execute({ name: 'failing_tool', input: {} }, context),
    ).rejects.toMatchObject({
      message: 'Tool execution failed',
      kind: 'execution_failed',
      toolName: 'failing_tool',
    });
  });
});
