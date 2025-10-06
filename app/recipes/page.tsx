'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Recipe = { id: string; title: string; tags: string[] | null };

export default function RecipesPage() {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, tags')
        .order('title');
      if (!error && data) setRows(data);
    };
    load();
  }, []);

  const filtered = rows.filter(r => (q ? r.title.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <div className="card">
      <h1>Recipes</h1>
      <input className="w-full border rounded-xl px-3 py-2 mb-3" placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(r => (
          <li key={r.id} className="border rounded-xl p-4">
            <div className="font-medium">{r.title}</div>
            <div className="mt-1">
              {(r.tags || []).map(t => <span key={t} className="badge">{t}</span>)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
