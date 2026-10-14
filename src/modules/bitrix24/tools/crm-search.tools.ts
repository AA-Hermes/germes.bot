import { z } from 'zod';
import type { ToolContext } from '../../../core/tools/tool.js';
import type { Tool } from '../../../core/tools/index.js';
import type { Bitrix24CrmService, CrmEntitySummary } from '../services/crm.service.js';

const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).default(10),
});

type SearchInput = z.infer<typeof searchInputSchema>;

const inputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 200 },
    limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
  },
  required: ['query'],
  additionalProperties: false,
};

function createSearchTool(
  name: string,
  description: string,
  search: (input: SearchInput, context: ToolContext) => Promise<CrmEntitySummary[]>,
): Tool<SearchInput, CrmEntitySummary[]> {
  return {
    definition: { name, description, inputSchema, risk: 'read' },
    parseInput: (input) => searchInputSchema.parse(input),
    execute: search,
  };
}

export function createBitrix24CrmReadTools(service: Bitrix24CrmService): Tool[] {
  return [
    createSearchTool(
      'crm_search_deals',
      'Search Bitrix24 CRM deals by title.',
      ({ query, limit }, context) => service.searchDeals(query, limit, context.portalDomain),
    ),
    createSearchTool(
      'crm_search_contacts',
      'Search Bitrix24 CRM contacts by name.',
      ({ query, limit }, context) => service.searchContacts(query, limit, context.portalDomain),
    ),
    createSearchTool(
      'crm_search_leads',
      'Search Bitrix24 CRM leads by title.',
      ({ query, limit }, context) => service.searchLeads(query, limit, context.portalDomain),
    ),
  ];
}
