import type { Tool, ToolDefinition } from './tool.js';
import { ToolError } from './tool-errors.js';

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

interface RegisteredTool {
  tool: Tool;
  definition: ToolDefinition;
}

function snapshotDefinition(definition: ToolDefinition): ToolDefinition {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: structuredClone(definition.inputSchema),
    risk: definition.risk,
  };
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(tools: Tool[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: Tool): void {
    const definition = snapshotDefinition(tool.definition);
    const { name } = definition;

    if (!TOOL_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid tool name: ${name}`);
    }

    if (this.tools.has(name)) {
      throw new Error(`Tool is already registered: ${name}`);
    }

    this.tools.set(name, { tool, definition });
  }

  get(name: string): Tool {
    const registered = this.tools.get(name);
    if (!registered) {
      throw new ToolError(`Unknown tool: ${name}`, 'not_found', name);
    }

    return {
      definition: snapshotDefinition(registered.definition),
      parseInput: registered.tool.parseInput.bind(registered.tool),
      execute: registered.tool.execute.bind(registered.tool),
    };
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map(({ definition }) =>
      snapshotDefinition(definition),
    );
  }
}
