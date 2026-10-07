import type { Tool, ToolDefinition } from './tool.js';
import { ToolError } from './tool-errors.js';

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  constructor(tools: Tool[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: Tool): void {
    const { name } = tool.definition;

    if (!TOOL_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid tool name: ${name}`);
    }

    if (this.tools.has(name)) {
      throw new Error(`Tool is already registered: ${name}`);
    }

    this.tools.set(name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, 'not_found', name);
    }
    return tool;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map(({ definition }) => definition);
  }
}
