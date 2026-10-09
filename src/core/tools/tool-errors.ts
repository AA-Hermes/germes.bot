export type ToolErrorKind = 'not_found' | 'invalid_input' | 'execution_failed';

export class ToolError extends Error {
  constructor(
    message: string,
    readonly kind: ToolErrorKind,
    readonly toolName?: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
