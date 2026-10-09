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
      parseInput: (input) => input,
      execute: vi.fn(async (input) => input),
    };

    const registry = new ToolRegistry([tool]);

    expect(registry.get('echo_tool').definition).toEqual(tool.definition);
    expect(registry.list()).toEqual([tool.definition]);
    expect(() => registry.get('missing_tool')).toThrow(ToolError);
  });

  it('does not expose mutable enforcement metadata', async () => {
    const execute = vi.fn();
    const tool: Tool = {
      definition: {
        name: 'dangerous_tool',
        description: 'Writes data',
        inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
        risk: 'write',
      },
      parseInput: (input) => input,
      execute,
    };
    const registry = new ToolRegistry([tool]);

    const listed = registry.list();
    listed[0].risk = 'read';
    (listed[0].inputSchema as { type?: string }).type = 'string';
    tool.definition.risk = 'read';

    const executor = new ToolExecutor(registry, createLogger());
    await expect(
      executor.execute({ name: 'dangerous_tool', input: {} }, context),
    ).rejects.toMatchObject({ kind: 'execution_failed' });
    expect(execute).not.toHaveBeenCalled();
    expect(registry.list()[0]).toMatchObject({
      risk: 'write',
      inputSchema: { type: 'object' },
    });
  });

  it('rejects duplicate and invalid tool names', () => {
    const tool: Tool = {
      definition: {
        name: 'echo_tool',
        description: 'Echoes input',
        inputSchema: { type: 'object' },
        risk: 'read',
      },
      parseInput: (input) => input,
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
  it('sanitizes ToolError messages thrown by concrete tools', async () => {
    const logger = createLogger();
    const executor = new ToolExecutor(
      new ToolRegistry([
        {
          definition: {
            name: 'wrapped_failure_tool',
            description: 'Wraps an upstream failure',
            inputSchema: { type: 'object' },
            risk: 'read',
          },
          parseInput: (input) => input,
          execute: vi.fn(async () => {
            throw new ToolError(
              'upstream response contains secret-token',
              'execution_failed',
              'wrapped_failure_tool',
            );
          }),
        },
      ]),
      logger,
    );

    await expect(
      executor.execute({ name: 'wrapped_failure_tool', input: {} }, context),
    ).rejects.toMatchObject({
      message: 'Tool execution failed',
      kind: 'execution_failed',
      toolName: 'wrapped_failure_tool',
    });
    expect(JSON.stringify((logger.error as ReturnType<typeof vi.fn>).mock.calls))
      .not.toContain('secret-token');
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
        parseInput: (input) => input,
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

  it('rejects invalid input before tool execution', async () => {
    const execute = vi.fn();
    const executor = new ToolExecutor(
      new ToolRegistry([
        {
          definition: {
            name: 'validated_tool',
            description: 'Validates input',
            inputSchema: { type: 'object' },
            risk: 'read',
          },
          parseInput: () => {
            throw new Error('invalid');
          },
          execute,
        },
      ]),
      createLogger(),
    );

    await expect(
      executor.execute({ name: 'validated_tool', input: null }, context),
    ).rejects.toMatchObject({ kind: 'invalid_input', toolName: 'validated_tool' });
    expect(execute).not.toHaveBeenCalled();
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
          parseInput: (input) => input,
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

  it('does not leak underlying execution errors to callers or logs', async () => {
    const logger = createLogger();
    const executor = new ToolExecutor(
      new ToolRegistry([
        {
          definition: {
            name: 'failing_tool',
            description: 'Fails',
            inputSchema: { type: 'object' },
            risk: 'read',
          },
          parseInput: (input) => input,
          execute: vi.fn(async () => {
            throw new Error('secret upstream details');
          }),
        },
      ]),
      logger,
    );

    let caught: unknown;
    try {
      await executor.execute({ name: 'failing_tool', input: {} }, context);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      message: 'Tool execution failed',
      kind: 'execution_failed',
      toolName: 'failing_tool',
    });
    expect((caught as Error).cause).toBeUndefined();
    expect(JSON.stringify((logger.error as ReturnType<typeof vi.fn>).mock.calls))
      .not.toContain('secret upstream details');
  });

});
