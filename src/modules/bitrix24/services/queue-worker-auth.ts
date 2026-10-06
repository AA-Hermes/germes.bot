import { timingSafeEqual } from 'node:crypto';

export function isQueueWorkerAuthorized(
  authorizationHeader: string | undefined,
  workerSecret: string | null,
): boolean {
  if (!authorizationHeader || !workerSecret) return false;
  if (!authorizationHeader.startsWith('Bearer ')) return false;

  const actual = Buffer.from(authorizationHeader.slice(7));
  const expected = Buffer.from(workerSecret);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
