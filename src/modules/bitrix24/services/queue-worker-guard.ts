import { timingSafeEqual } from 'node:crypto';

export function allowsWorkerRequest(
  headerValue: string | undefined,
  configuredValue: string | null,
): boolean {
  if (!headerValue || !configuredValue) return false;
  if (!headerValue.startsWith('Bearer ')) return false;

  const actual = Buffer.from(headerValue.slice(7));
  const expected = Buffer.from(configuredValue);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
