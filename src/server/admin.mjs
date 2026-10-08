import { timingSafeEqual } from 'node:crypto';

export function authorized(request) {
  const expected = process.env.ONERRD_ADMIN_API_KEY;
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || expected.length < 32 || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
