import { describe, expect, it, vi } from 'vitest';
import { ToolExecutor, ToolRegistry } from '../src/core/tools/index.js';
import { Bitrix24CrmService } from '../src/modules/bitrix24/services/crm.service.js';
import { createBitrix24CrmReadTools } from '../src/modules/bitrix24/tools/index.js';
import type { Bitrix24RestClient } from '../src/modules/bitrix24/services/rest-client.service.js';
import type { FastifyBaseLogger } from 'fastify';

const context = { channel: 'bitrix24', conversationId: 'chat5', userId: '42', portalDomain: 'original.bitrix24.com' };

function logger(): FastifyBaseLogger {
  return { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;
}

describe('Bitrix24 CRM read tools', () => {
  it('searches deals through the CRM service and returns normalized data', async () => {
    const call = vi.fn(async () => ({
      items: [
        {
          id: 17,
          title: 'ACME renewal',
          stageId: 'C1:NEW',
          companyId: 4,
          ignoredSecretField: 'must not reach the model',
        },
      ],
    }));
    const service = new Bitrix24CrmService({ call } as unknown as Bitrix24RestClient);
    const executor = new ToolExecutor(
      new ToolRegistry(createBitrix24CrmReadTools(service)),
      logger(),
    );

    await expect(
      executor.execute(
        { name: 'crm_search_deals', input: { query: 'ACME', limit: 5 } },
        context,
      ),
    ).resolves.toEqual({
      name: 'crm_search_deals',
      output: [{ id: 17, title: 'ACME renewal', stageId: 'C1:NEW', companyId: 4 }],
    });

    expect(call).toHaveBeenCalledWith(
      'crm.item.list',
      expect.objectContaining({
        entityTypeId: 2,
        filter: { '%title': 'ACME' },
      }),
      'original.bitrix24.com',
    );
  });

  it('searches contacts by first name or surname', async () => {
    const call = vi.fn(async () => ({ items: [{ id: 23, name: 'John', lastName: 'Smith' }] }));
    const service = new Bitrix24CrmService({ call } as unknown as Bitrix24RestClient);
    await expect(service.searchContacts('Smith', 10)).resolves.toEqual([
      { id: 23, name: 'John', lastName: 'Smith' },
    ]);
    expect(call).toHaveBeenCalledWith('crm.item.list', expect.objectContaining({
      entityTypeId: 3,
      filter: { logic: 'OR', '%name': 'Smith', '%lastName': 'Smith' },
    }));
  });

  it('validates search input before any Bitrix24 request', async () => {
    const call = vi.fn();
    const service = new Bitrix24CrmService({ call } as unknown as Bitrix24RestClient);
    const executor = new ToolExecutor(
      new ToolRegistry(createBitrix24CrmReadTools(service)),
      logger(),
    );

    await expect(
      executor.execute(
        { name: 'crm_search_contacts', input: { query: '', limit: 100 } },
        context,
      ),
    ).rejects.toMatchObject({ kind: 'invalid_input' });

    expect(call).not.toHaveBeenCalled();
  });

  it('registers only explicit read-only CRM operations', () => {
    const service = new Bitrix24CrmService({} as Bitrix24RestClient);
    const definitions = new ToolRegistry(createBitrix24CrmReadTools(service)).list();

    expect(definitions.map(({ name }) => name)).toEqual([
      'crm_search_deals',
      'crm_search_contacts',
      'crm_search_leads',
    ]);
    expect(definitions.every(({ risk }) => risk === 'read')).toBe(true);
  });
});
