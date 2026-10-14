import type { FastifyBaseLogger } from 'fastify';
import type { LLMGenerateInput } from '../../../core/llm/llm-provider.js';
import { createLLMProvider } from '../../../core/llm/index.js';
import { ToolExecutor } from '../../../core/tools/tool-executor.js';
import { ToolRegistry } from '../../../core/tools/tool-registry.js';
import { WorkflowService } from '../../../core/workflow/workflow.service.js';
import { Bitrix24CrmService } from './crm.service.js';
import type { Bitrix24RestClient } from './rest-client.service.js';
import { createBitrix24CrmReadTools } from '../tools/index.js';

/**
 * Shared workflow composition for the webhook handler and queue recovery worker.
 * CRM access is disabled unless a verified Bitrix24 user ID is allowlisted.
 * A numeric dialogId matching the author ID is required for a direct conversation;
 * chat-prefixed group dialogs are never authorized. Unknown dialog formats fail closed.
 */
export function canUseBitrix24CrmTools(input: LLMGenerateInput, allowedUserIds: ReadonlySet<string>): boolean {
  return input.channel === 'bitrix24' &&
    input.chatType === 'private' &&
    Boolean(input.userId && allowedUserIds.has(input.userId));
}

export function createBitrix24Workflow(client: Bitrix24RestClient, logger: FastifyBaseLogger): WorkflowService {
  const allowedUserIds = new Set(
    (process.env.BITRIX24_CRM_TOOL_ALLOWED_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^[0-9]+$/.test(id)),
  );
  const executor = new ToolExecutor(
    new ToolRegistry(createBitrix24CrmReadTools(new Bitrix24CrmService(client))),
    logger,
  );
  return new WorkflowService(
    createLLMProvider(executor, (input) => canUseBitrix24CrmTools(input, allowedUserIds)),
    logger,
  );
}
