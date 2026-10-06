export interface QueuedEventInput {
  channel: string;
  externalId: string;
  conversationId: string;
  userId?: string;
  text: string;
}

export interface QueuedEvent extends QueuedEventInput {
  id: number;
  attempts: number;
}

export interface EventQueue {
  enqueue(event: QueuedEventInput): Promise<boolean>;
  claim(limit: number): Promise<QueuedEvent[]>;
  beginDelivery(id: number): Promise<boolean>;
  markDelivered(id: number, outboundMessageId: number): Promise<void>;
  failDelivery(id: number, errorName: string): Promise<void>;
  retry(id: number, attempts: number, errorName: string): Promise<void>;
}
