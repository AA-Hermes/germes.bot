import { config } from '../config/index.js';
import type { IntegrationStorage } from './integration-storage.js';
import { FileIntegrationStorage } from './file-integration-storage.js';
import { PostgresIntegrationStorage } from './postgres-integration-storage.js';

let storage: IntegrationStorage | null = null;

export function getIntegrationStorage(): IntegrationStorage {
  if (storage) return storage;

  storage = config.databaseUrl
    ? new PostgresIntegrationStorage(config.databaseUrl)
    : new FileIntegrationStorage(config.storageFile);

  return storage;
}
