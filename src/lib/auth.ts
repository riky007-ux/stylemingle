import type { Headers } from 'next/server';

export function getUserIdFromAuthHeader(headers: Headers): string | null {
  const auth = headers.get('authorization') || headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.split(' ')[1];
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1];
  try {
    const base = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - base.length % 4) % 4);
    const decoded = Buffer.from(base + pad, 'base64').toString('utf-8');
    const data = JSON.parse(decoded);
    const userId = data.userId || data.sub || data.id;
    return typeof userId === 'string' ? userId : null;
  } catch (e) {
    return null;
  }
}
