'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import AuthBanner from '@/components/AuthBanner';

type LC = { id: string; name: string; tags: string[] | null };

export default function LunchPage() {
  const [rows, setRows] = useState<LC[]>([]);
  useEffect(() => {
    supabase.from('lunch_components').select('id,name,tags').order('name')
      .then(({data}) => data && setRows(data));
  }, []);
  return (
    <div className="card">
      <h1>School lunch mains</h1>
      <AuthBanner />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(r => (
          <li key={r.id} className="border rounded-xl p-4">
            <div className="font-medium">{r.name}</div>
            <div className="mt-1">{(r.tags||[]).map(t=><span key={t} className="badge">{t}</span>)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
