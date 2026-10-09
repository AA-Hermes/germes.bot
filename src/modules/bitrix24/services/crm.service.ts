import { Bitrix24RestClient } from './rest-client.service.js';

interface BitrixListResult<T> {
  items: T[];
}

export interface CrmEntitySummary {
  id: number;
  title?: string;
  name?: string;
  lastName?: string;
  stageId?: string;
  companyId?: number;
}

function normalizeId(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function normalizeEntity(value: Record<string, unknown>): CrmEntitySummary | null {
  const id = normalizeId(value.id);
  if (!id) return null;

  return {
    id,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.lastName === 'string' ? { lastName: value.lastName } : {}),
    ...(typeof value.stageId === 'string' ? { stageId: value.stageId } : {}),
    ...(normalizeId(value.companyId) ? { companyId: normalizeId(value.companyId) } : {}),
  };
}

export class Bitrix24CrmService {
  constructor(private readonly client: Bitrix24RestClient) {}

  async searchDeals(query: string, limit: number): Promise<CrmEntitySummary[]> {
    return this.list('crm.item.list', {
      entityTypeId: 2,
      filter: { '%title': query },
      select: ['id', 'title', 'stageId', 'companyId'],
      order: { updatedTime: 'DESC' },
      start: 0,
    }, limit);
  }

  async searchContacts(query: string, limit: number): Promise<CrmEntitySummary[]> {
    return this.list('crm.item.list', {
      entityTypeId: 3,
      filter: { '%name': query },
      select: ['id', 'name', 'lastName', 'companyId'],
      order: { updatedTime: 'DESC' },
      start: 0,
    }, limit);
  }

  async searchLeads(query: string, limit: number): Promise<CrmEntitySummary[]> {
    return this.list('crm.item.list', {
      entityTypeId: 1,
      filter: { '%title': query },
      select: ['id', 'title', 'stageId', 'companyId'],
      order: { updatedTime: 'DESC' },
      start: 0,
    }, limit);
  }

  private async list(
    method: string,
    params: Record<string, unknown>,
    limit: number,
  ): Promise<CrmEntitySummary[]> {
    const result = await this.client.call<BitrixListResult<Record<string, unknown>>>(
      method,
      params,
    );

    return result.items
      .map(normalizeEntity)
      .filter((item): item is CrmEntitySummary => item !== null)
      .slice(0, limit);
  }
}
