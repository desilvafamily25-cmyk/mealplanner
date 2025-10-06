'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

type Item = { id: string; ingredient_id: string | null; name_override: string | null; qty: number | null; unit: string | null; aisle: string | null; checked: boolean | null };
type Ingredient = { id: string; name: string };

export default function ListPage() {
  const params = useParams();
  const listId = params?.listId as string;
  const [items, setItems] = useState<Item[]>([]);
  const [ingredients, setIngredients] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: it }, { data: ing }] = await Promise.all([
      supabase.from('shopping_list_items').select('*').eq('shopping_list_id', listId).order('aisle'),
      supabase.from('ingredients').select('id,name')
    ]);
    setItems(it || []);
    const map: Record<string,string> = {};
    (ing||[]).forEach((r: Ingredient)=> map[r.id] = r.name);
    setIngredients(map);
  };

  useEffect(() => { load(); }, [listId]);

  const toggle = async (id: string, checked: boolean) => {
    await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
    setItems(prev => prev.map(i => i.id===id ? { ...i, checked } : i));
  };

  const grouped = items.reduce((acc: Record<string, Item[]>, it) => {
    const key = it.aisle || 'Other';
    acc[key] = acc[key] || [];
    acc[key].push(it);
    return acc;
  }, {});

  return (
    <div className="card">
      <h1>Shopping list</h1>
      {Object.entries(grouped).map(([aisle, group]) => (
        <div key={aisle} className="mb-6">
          <h2>{aisle}</h2>
          <ul className="space-y-2">
            {group.map(it => (
              <li key={it.id} className="flex items-center gap-3">
                <input type="checkbox" checked={!!it.checked} onChange={e=>toggle(it.id, e.target.checked)} />
                <span className={it.checked ? 'line-through text-gray-400' : ''}>
                  {it.name_override || (it.ingredient_id ? ingredients[it.ingredient_id] : 'Item')}
                  {it.qty ? ` — ${it.qty}${it.unit?(' '+it.unit):''}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
