'use client';
// Calls our own API routes; errors come back as { error, code } and are thrown as ApiError.
export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong.', data.code ?? 'error', res.status);
  return data as T;
}

/** Friendly copy for database limits raised by triggers. */
export function dbErrorMessage(message: string) {
  if (message.includes('item_limit_reached')) return 'You’ve reached your plan’s wardrobe limit. Upgrade to add more pieces.';
  if (message.includes('profile_limit_reached')) return 'Your plan allows no more wardrobe profiles. Upgrade to Pro for up to 3.';
  return 'Could not save. Please try again.';
}
