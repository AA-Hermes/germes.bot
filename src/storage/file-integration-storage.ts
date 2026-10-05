import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AuthTokens, IntegrationStorage } from './integration-storage.js';

interface State {
  botId: number | null;
  tokens: AuthTokens | null;
}

const EMPTY_STATE: State = { botId: null, tokens: null };

export class FileIntegrationStorage implements IntegrationStorage {
  constructor(private readonly filePath: string) {}

  private async readState(): Promise<State> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as State;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { ...EMPTY_STATE };
      throw error;
    }
  }

  private async writeState(state: State): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  }

  async getBotId(): Promise<number | null> {
    return (await this.readState()).botId;
  }

  async setBotId(id: number | null): Promise<void> {
    const state = await this.readState();
    await this.writeState({ ...state, botId: id });
  }

  async getTokens(): Promise<AuthTokens | null> {
    return (await this.readState()).tokens;
  }

  async saveTokens(tokens: AuthTokens | null): Promise<void> {
    const state = await this.readState();
    await this.writeState({ ...state, tokens });
  }
}
