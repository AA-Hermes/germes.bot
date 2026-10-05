export interface BotRegistration {
  registered: boolean;
  botId: number;
  name: string;
}

export interface SendMessageResult {
  id: number;
}

export interface BitrixBot {
  id: number;
  code: string;
}

export interface BotRegisterResult {
  bot: BitrixBot;
}

export interface BotListResult {
  bots: BitrixBot[];
  hasNextPage: boolean;
}
