'use client';
import { useMemo, useState } from 'react';
import { ChevronRight, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LocationRow } from '@/lib/model';
import { Button, cx, IconButton, Input, Select, useToast } from '@/components/ui';
import { useStore } from './store';

export const LOCATION_KINDS = [
  { id: 'room', label: 'Room' }, { id: 'wardrobe', label: 'Wardrobe' }, { id: 'shelf', label: 'Shelf' }, { id: 'drawer', label: 'Drawer' },
  { id: 'box', label: 'Box' }, { id: 'pouch', label: 'Pouch' }, { id: 'place', label: 'Other place' },
];

/** Locations flattened depth-first with their full path, for selects and search. */
export function useLocationTree() {
  const { locations } = useStore();
  return useMemo(() => {
    const kids = new Map<string | null, LocationRow[]>();
    locations.forEach(l => { const k = l.parent_id ?? null; kids.set(k, [...(kids.get(k) ?? []), l]); });
    const flat: { loc: LocationRow; depth: number; path: string }[] = [];
    const walk = (parent: string | null, depth: number, prefix: string) => {
      for (const l of (kids.get(parent) ?? []).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))) {
        const path = prefix ? `${prefix} › ${l.name}` : l.name;
        flat.push({ loc: l, depth, path });
        walk(l.id, depth + 1, path);
      }
    };
    walk(null, 0, '');
    return { flat, kids };
  }, [locations]);
}

export function LocationSelect({ value, onChange, id }: { value: string | null; onChange: (v: string | null) => void; id?: string }) {
  const { flat } = useLocationTree();
  const { sb, user, wardrobeId, reload } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    const { data } = await sb.from('clothing_locations').insert({ user_id: user.id, wardrobe_profile_id: wardrobeId, name: name.trim().slice(0, 60), parent_id: value, kind: 'place' }).select('id').single();
    await reload();
    if (data) onChange(data.id);
    setName(''); setAdding(false);
  };
  return (
    <div className="space-y-2">
      <Select id={id} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">Not set</option>
        {flat.map(f => <option key={f.loc.id} value={f.loc.id}>{'  '.repeat(f.depth)}{f.loc.name}</option>)}
      </Select>
      {adding ? (
        <div className="flex gap-2">
          <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={value ? 'Inside the selected place…' : 'e.g. Bedroom wardrobe'} onKeyDown={e => e.key === 'Enter' && add()} />
          <Button size="sm" onClick={add}>Add</Button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm text-accent"><Plus className="size-4" /> New place{value ? ' inside this one' : ''}</button>
      )}
    </div>
  );
}

/** Editable hierarchy: Room → Wardrobe → Shelf/Drawer → Box/Pouch. */
export function LocationTree({ onPick, selected }: { onPick?: (id: string) => void; selected?: string | null }) {
  const { kids } = useLocationTree();
  const { sb, user, wardrobeId, items, reload } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id?: string; parent: string | null; name: string; kind: string } | null>(null);
  const counts = useMemo(() => { const m = new Map<string, number>(); items.forEach(i => i.location_id && m.set(i.location_id, (m.get(i.location_id) ?? 0) + 1)); return m; }, [items]);

  const save = async () => {
    if (!editing?.name.trim()) return;
    const row = { name: editing.name.trim().slice(0, 60), kind: editing.kind };
    const { error } = editing.id
      ? await sb.from('clothing_locations').update(row).eq('id', editing.id)
      : await sb.from('clothing_locations').insert({ ...row, user_id: user.id, wardrobe_profile_id: wardrobeId, parent_id: editing.parent });
    if (error) toast('Could not save that place.', { tone: 'bad' });
    if (editing.parent) setOpen(s => new Set(s).add(editing.parent!));
    setEditing(null);
    await reload();
  };
  const remove = async (l: LocationRow) => {
    if (!confirm(`Delete “${l.name}” and the places inside it? Clothes stored there are kept but their place is cleared.`)) return;
    await sb.from('clothing_locations').delete().eq('id', l.id);
    await reload();
  };

  const editor = () => editing && (
    <div className="my-1 flex flex-wrap gap-2 rounded-xl bg-sunk p-2">
      <Input autoFocus aria-label="Place name" className="min-w-40 flex-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Name" />
      <Select aria-label="Type of place" className="w-36" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value })}>
        {LOCATION_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
      </Select>
      <Button size="sm" onClick={save}>Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
    </div>
  );

  const render = (parent: string | null, depth: number): React.ReactNode => (
    <ul className={cx(depth > 0 && 'ml-4 border-l border-line pl-2')}>
      {(kids.get(parent) ?? []).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)).map(l => {
        const has = (kids.get(l.id) ?? []).length > 0, isOpen = open.has(l.id);
        return (
          <li key={l.id}>
            <div className={cx('group flex items-center gap-1 rounded-lg pr-1', selected === l.id && 'bg-accent-soft')}>
              <button aria-label={isOpen ? 'Collapse' : 'Expand'} disabled={!has} onClick={() => setOpen(s => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} className="flex size-8 items-center justify-center text-muted disabled:opacity-0">
                <ChevronRight className={cx('size-4 transition', isOpen && 'rotate-90')} />
              </button>
              <button onClick={() => onPick?.(l.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm">
                <span className="truncate">{l.name}</span>
                <span className="text-xs text-muted">{LOCATION_KINDS.find(k => k.id === l.kind)?.label}{counts.get(l.id) ? ` · ${counts.get(l.id)}` : ''}</span>
              </button>
              <IconButton label={`Add a place inside ${l.name}`} onClick={() => setEditing({ parent: l.id, name: '', kind: 'shelf' })}><FolderPlus className="size-4" /></IconButton>
              <IconButton label={`Rename ${l.name}`} onClick={() => setEditing({ id: l.id, parent: l.parent_id, name: l.name, kind: l.kind })}><Pencil className="size-4" /></IconButton>
              <IconButton label={`Delete ${l.name}`} onClick={() => remove(l)}><Trash2 className="size-4" /></IconButton>
            </div>
            {editing && editing.parent === l.id && !editing.id && <div className="ml-8">{editor()}</div>}
            {editing?.id === l.id && <div className="ml-8">{editor()}</div>}
            {has && isOpen && render(l.id, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {render(null, 0)}
      {editing && editing.parent === null && !editing.id ? editor() : (
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setEditing({ parent: null, name: '', kind: 'room' })}><Plus className="size-4" /> Add a room or place</Button>
      )}
    </div>
  );
}
