'use client';
import { useActionState, useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import type { Result } from './actions';

/** JSON editor for one row; the server validates the shape before saving. */
export function JsonEditor({ title, value, action, hidden }: { title: string; value: unknown; action: (s: Result | null, f: FormData) => Promise<Result>; hidden?: Record<string, string> }) {
  const [state, run, pending] = useActionState(action, null);
  // Controlled, so edits survive React resetting the form after an action.
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  return (
    <form action={run} className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-medium">{title}</h3><Button size="sm" type="submit" loading={pending}>Save</Button></div>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Textarea name="json" aria-label={`${title} JSON`} value={text} onChange={e => setText(e.target.value)} spellCheck={false} className="min-h-56 font-mono text-xs leading-relaxed" />
      {state && <p role="status" className={`mt-2 text-sm ${state.ok ? 'text-sage' : 'text-danger'}`}>{state.message}</p>}
    </form>
  );
}
