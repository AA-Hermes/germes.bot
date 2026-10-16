import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  AuthTokens,
  Bitrix24CredentialsSnapshot,
  Bitrix24Installation,
  IntegrationStorage,
} from './integration-storage.js';

interface State {
  botId: number | null;
  tokens: AuthTokens | null;
  bitrix24Installation: Bitrix24Installation | null;
}

const EMPTY_STATE: State = {
  botId: null,
  tokens: null,
  bitrix24Installation: null,
};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

export class FileIntegrationStorage implements IntegrationStorage {
  constructor(private readonly filePath: string) {}

  private async readState(): Promise<State> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as State;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return { ...EMPTY_STATE };
      throw error;
    }
  }

  private async writeState(state: State): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  }

  async getCredentialsSnapshot(): Promise<Bitrix24CredentialsSnapshot> {
    const state = await this.readState();
    return { tokens: state.tokens, installation: state.bitrix24Installation };
  }

  async saveCredentialsSnapshot(snapshot: Bitrix24CredentialsSnapshot): Promise<void> {
    const state = await this.readState();
    await this.writeState({ ...state, tokens: snapshot.tokens, bitrix24Installation: snapshot.installation });
  }

  async saveTokensIfUnchanged(tokens: AuthTokens, previous: Bitrix24CredentialsSnapshot): Promise<boolean> {
    const state = await this.readState();
    if (JSON.stringify(state.tokens) !== JSON.stringify(previous.tokens) ||
        JSON.stringify(state.bitrix24Installation) !== JSON.stringify(previous.installation)) return false;
    await this.writeState({ ...state, tokens });
    return true;
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

  async getBitrix24Installation(): Promise<Bitrix24Installation | null> {
    return (await this.readState()).bitrix24Installation;
  }

  async saveBitrix24Installation(
    installation: Bitrix24Installation | null,
  ): Promise<void> {
    const state = await this.readState();
    await this.writeState({ ...state, bitrix24Installation: installation });
  }
}
