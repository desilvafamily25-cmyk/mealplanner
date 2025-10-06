'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type PlanRow = { plan_date: string; slot: 'dinner'|'lunch'; title: string | null };
type Recipe  = { id: string; title: string };
type Lunch   = { id: string; name: string };

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0,0,0,0);
  return monday;
}
function fmt(d: Date) { return d.toISOString().slice(0,10); }

export default function PlanPage() {
  const [householdId, setHouseholdId] = useState<string>('');
  const [mealPlanId, setMealPlanId]   = useState<string>('');
  const [weekStart, setWeekStart]     = useState(fmt(startOfWeek(new Date())));
  const [rows, setRows]               = useState<PlanRow[]>([]);
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [lunches, setLunches]         = useState<Lunch[]>([]);
  const [qDinner, setQDinner]         = useState('');
  const [qLunch, setQLunch]           = useState('');
  const [editing, setEditing]         = useState<null | { slot: 'dinner'|'lunch', date: string }>(null);
  const [busy, setBusy]               = useState(false);

  useEffect(() => {
    supabase.rpc('get_my_household').then(({ data, error }) => {
      if (!error && data) setHouseholdId(data);
    });
  }, []);

  useEffect(() => {
    const ensure = async () => {
      if (!householdId) return;
      const { data, error } = await supabase
        .from('meal_plans').select('id')
        .eq('household_id', householdId).eq('week_start', weekStart).maybeSingle();
      if (error && error.code !== 'PGRST116') return;
      if (data?.id) { setMealPlanId(data.id); return; }
      const ins = await supabase.from('meal_plans')
        .insert({ household_id: householdId, week_start: weekStart })
        .select('id').single();
      if (!ins.error) setMealPlanId(ins.data.id);
    };
    ensure();
  }, [householdId, weekStart]);

  async function reloadWeek() {
    const to = new Date(new Date(weekStart).getTime()+6*86400000).toISOString().slice(0,10);
    const { data } = await supabase.from('v_meal_plan_flat')
      .select('plan_date,slot,title').gte('plan_date', weekStart).lte('plan_date', to);
    setRows(data || []);
  }
  useEffect(() => { if (householdId) reloadWeek(); }, [householdId, weekStart]);

  useEffect(() => {
    if (!householdId) return;
    Promise.all([
      supabase.from('recipes').select('id,title').order('title'),
      supabase.from('lunch_components').select('id,name').order('name')
    ]).then(([r,l]) => {
      if (r.data) setRecipes(r.data);
      if (l.data) setLunches(l.data);
    });
  }, [householdId]);

  const days = useMemo(()=>{
    const start = new Date(weekStart);
    return Array.from({length:7}, (_,i)=>{ const d = new Date(start); d.setDate(start.getDate()+i); return fmt(d); });
  }, [weekStart]);

  const getRow = (date: string, slot: 'dinner'|'lunch') =>
    rows.find(r => r.plan_date === date && r.slot === slot);

  async function setDinner(date: string, recipeId: string) {
    if (!mealPlanId) return;
    setBusy(true);
    const { data: ex } = await supabase.from('meal_plan_items')
      .select('id').eq('meal_plan_id', mealPlanId).eq('plan_date', date).eq('slot', 'dinner').maybeSingle();
    if (ex?.id) await supabase.from('meal_plan_items').update({ recipe_id: recipeId }).eq('id', ex.id);
    else await supabase.from('meal_plan_items').insert({ meal_plan_id: mealPlanId, plan_date: date, slot: 'dinner', recipe_id: recipeId });
    await reloadWeek(); setEditing(null); setBusy(false);
  }

  async function setLunch(date: string, lunchId: string) {
    if (!mealPlanId) return;
    setBusy(true);
    const { data: ex } = await supabase.from('meal_plan_items')
      .select('id').eq('meal_plan_id', mealPlanId).eq('plan_date', date).eq('slot', 'lunch').maybeSingle();
    let lunchItemId = ex?.id;
    if (!lunchItemId) {
      const ins = await supabase.from('meal_plan_items').insert({ meal_plan_id: mealPlanId, plan_date: date, slot: 'lunch' }).select('id').single();
      lunchItemId = ins.data?.id;
    }
    await supabase.from('meal_plan_lunch_components').delete().eq('meal_plan_item_id', lunchItemId as string);
    await supabase.from('meal_plan_lunch_components').insert({ meal_plan_item_id: lunchItemId as string, lunch_component_id: lunchId, servings: 1 });
    await reloadWeek(); setEditing(null); setBusy(false);
  }

  async function clearSlot(date: string, slot: 'dinner'|'lunch') {
    if (!mealPlanId) return;
    setBusy(true);
    const { data: ex } = await supabase.from('meal_plan_items')
      .select('id').eq('meal_plan_id', mealPlanId).eq('plan_date', date).eq('slot', slot).maybeSingle();
    if (ex?.id) {
      await supabase.from('meal_plan_lunch_components').delete().eq('meal_plan_item_id', ex.id);
      await supabase.from('meal_plan_items').delete().eq('id', ex.id);
    }
    await reloadWeek(); setEditing(null); setBusy(false);
  }

  const filteredRecipes = recipes.filter(r => qDinner ? r.title.toLowerCase().includes(qDinner.toLowerCase()) : true);
  const filteredLunches = lunches.filter(l => qLunch ? l.name.toLowerCase().includes(qLunch.toLowerCase()) : true);

  const generateList = async () => {
    if (!householdId) return alert('No household linked.');
    const { data, error } = await supabase.rpc('create_shopping_list_for_week', { p_household: householdId, p_week_start: weekStart });
    if (error) return alert(error.message);
    window.location.href = `/shopping-list/${data}`;
  };

  return (
    <div className="card">
      <h1>Meal plan — editable</h1>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label>Week start (Mon):</label>
        <input type="date" className="border rounded-xl px-3 py-2" value={weekStart} onChange={e=>setWeekStart(e.target.value)} />
        <button className="btn-primary btn" onClick={generateList}>Generate shopping list</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map(d => {
          const dinner = getRow(d, 'dinner')?.title || '';
          const lunch  = getRow(d, 'lunch')?.title || '';
          const isEdD = editing?.date === d && editing?.slot === 'dinner';
          const isEdL = editing?.date === d && editing?.slot === 'lunch';
          return (
            <div key={d} className="border rounded-xl p-3">
              <div className="text-sm font-medium mb-2">{d}</div>

              <div className="mb-3">
                <div className="text-sm mb-1"><span className="badge">Dinner</span> {dinner || <em>—</em>}</div>
                {!isEdD ? (
                  <div className="flex gap-2">
                    <button className="btn" onClick={()=>setEditing({ slot:'dinner', date:d })}>
                      {dinner ? 'Change' : 'Add dinner'}
                    </button>
                    {dinner && <button className="btn" onClick={()=>clearSlot(d,'dinner')}>Remove</button>}
                  </div>
                ) : (
                  <div className="mt-2">
                    <input className="w-full border rounded-xl px-3 py-2 mb-2" placeholder="Search recipes…" value={qDinner} onChange={e=>setQDinner(e.target.value)} />
                    <ul className="max-h-48 overflow-auto border rounded-xl">
                      {filteredRecipes.map(r => (
                        <li key={r.id}>
                          <button disabled={busy} className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={()=>setDinner(d, r.id)}>{r.title}</button>
                        </li>
                      ))}
                      {filteredRecipes.length===0 && <li className="px-3 py-2 text-sm text-gray-500">No recipes</li>}
                    </ul>
                    <div className="mt-2"><button className="btn" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm mb-1"><span className="badge">Lunch</span> {lunch || <em>—</em>}</div>
                {!isEdL ? (
                  <div className="flex gap-2">
                    <button className="btn" onClick={()=>setEditing({ slot:'lunch', date:d })}>
                      {lunch ? 'Change' : 'Add lunch main'}
                    </button>
                    {lunch && <button className="btn" onClick={()=>clearSlot(d,'lunch')}>Remove</button>}
                  </div>
                ) : (
                  <div className="mt-2">
                    <input className="w-full border rounded-xl px-3 py-2 mb-2" placeholder="Search lunch mains…" value={qLunch} onChange={e=>setQLunch(e.target.value)} />
                    <ul className="max-h-48 overflow-auto border rounded-xl">
                      {lunches.filter(l=>!qLunch || l.name.toLowerCase().includes(qLunch.toLowerCase())).map(lc => (
                        <li key={lc.id}>
                          <button disabled={busy} className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={()=>setLunch(d, lc.id)}>{lc.name}</button>
                        </li>
                      ))}
                      {filteredLunches.length===0 && <li className="px-3 py-2 text-sm text-gray-500">No lunch mains</li>}
                    </ul>
                    <div className="mt-2"><button className="btn" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
