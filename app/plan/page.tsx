'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import AuthBanner from '@/components/AuthBanner';

type PlanRow = { plan_date: string; slot: 'dinner'|'lunch'; title: string | null };
type Recipe  = { id: string; title: string };
type Lunch   = { id: string; name: string };

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0,0,0,0);
  return monday;
}
function fmtISO(d: Date) { return d.toISOString().slice(0,10); }
function fmtAU(dateIso: string) {
  const d = new Date(dateIso);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function PlanPage() {
  const [householdId, setHouseholdId] = useState<string>('');
  const [mealPlanId, setMealPlanId]   = useState<string>('');
  const [weekStart, setWeekStart]     = useState(fmtISO(startOfWeek(new Date())));
  const [rows, setRows]               = useState<PlanRow[]>([]);
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [lunches, setLunches]         = useState<Lunch[]>([]);
  const [qDinner, setQDinner]         = useState('');
  const [qLunch, setQLunch]           = useState('');
  const [editing, setEditing]         = useState<null | { slot: 'dinner'|'lunch', date: string }>(null);
  const [busy, setBusy]               = useState(false);

  // get household (needed for everything)
  useEffect(() => {
    supabase.rpc('get_my_household').then(({ data }) => data && setHouseholdId(data));
  }, []);

  // ensure a meal_plan exists for this week
  useEffect(() => {
    const ensure = async () => {
      if (!householdId) return;
      const { data } = await supabase
        .from('meal_plans').select('id')
        .eq('household_id', householdId)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (data?.id) { setMealPlanId(data.id); return; }
      const ins = await supabase.from('meal_plans')
        .insert({ household_id: householdId, week_start: weekStart })
        .select('id').single();
      if (ins.data?.id) setMealPlanId(ins.data.id);
    };
    ensure();
  }, [householdId, weekStart]);

  // compute week days
  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({length:7}, (_,i)=>{ const d = new Date(start); d.setDate(start.getDate()+i); return fmtISO(d); });
  }, [weekStart]);

  // pull the flat view for the week (drives both dinner & lunch labels)
  async function reloadWeek() {
    const to = new Date(new Date(weekStart).getTime()+6*86400000).toISOString().slice(0,10);
    const { data } = await supabase
      .from('v_meal_plan_flat')
      .select('plan_date,slot,title')
      .gte('plan_date', weekStart)
      .lte('plan_date', to);
    setRows(data || []);
  }
  useEffect(() => { if (householdId) reloadWeek(); }, [householdId, weekStart]);

  // load pick lists
  useEffect(() => {
    if (!householdId) return;
    Promise.all([
      supabase.from('recipes').select('id,title').order('title'),
      supabase.from('lunch_components').select('id,name').order('name')
    ]).then(([r,l]) => { if (r.data) setRecipes(r.data); if (l.data) setLunches(l.data); });
  }, [householdId]);

  const getRow = (date: string, slot: 'dinner'|'lunch') =>
    rows.find(r => r.plan_date === date && r.slot === slot);

  // actions
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
      const ins = await supabase.from('meal_plan_items')
        .insert({ meal_plan_id: mealPlanId, plan_date: date, slot: 'lunch' })
        .select('id').single();
      lunchItemId = ins.data?.id;
    }
    // exactly one lunch per day — wipe old and set new
    await supabase.from('meal_plan_lunch_components').delete().eq('meal_plan_item_id', lunchItemId as string);
    await supabase.from('meal_plan_lunch_components')
      .insert({ meal_plan_item_id: lunchItemId as string, lunch_component_id: lunchId, servings: 1 });
    await reloadWeek(); setEditing(null); setBusy(false);
  }

  async function clearSlot(date: string, slot: 'dinner'|'lunch') {
  if (!mealPlanId) return;
  setBusy(true);

  // Find ALL items for that day/slot and delete them
  const { data: items, error: selErr } = await supabase
    .from('meal_plan_items')
    .select('id')
    .eq('meal_plan_id', mealPlanId)
    .eq('plan_date', date)
    .eq('slot', slot);

  if (selErr) { alert(selErr.message); setBusy(false); return; }

  const ids = (items || []).map(i => i.id);
  if (ids.length) {
    // delete lunch joins first (safe even for dinners)
    const { error: delJoinErr } = await supabase
      .from('meal_plan_lunch_components')
      .delete()
      .in('meal_plan_item_id', ids);
    if (delJoinErr) { alert(delJoinErr.message); setBusy(false); return; }

    const { error: delErr } = await supabase
      .from('meal_plan_items')
      .delete()
      .in('id', ids);
    if (delErr) { alert(delErr.message); setBusy(false); return; }
  }

  await reloadWeek();
  setEditing(null);
  setBusy(false);
}

  }

  // reset entire week (no confirm; shopping lists untouched)
  async function resetWeek() {
    if (!mealPlanId) return;
    setBusy(true);
    const from = weekStart;
    const to = new Date(new Date(weekStart).getTime()+6*86400000).toISOString().slice(0,10);
    const { data: items } = await supabase
      .from('meal_plan_items')
      .select('id')
      .eq('meal_plan_id', mealPlanId)
      .gte('plan_date', from)
      .lte('plan_date', to);
    const ids = (items || []).map(i => i.id);
    if (ids.length) {
      await supabase.from('meal_plan_lunch_components').delete().in('meal_plan_item_id', ids);
      await supabase.from('meal_plan_items').delete().in('id', ids);
    }
    await reloadWeek(); setBusy(false);
  }

  const filteredRecipes = recipes.filter(r => qDinner ? r.title.toLowerCase().includes(qDinner.toLowerCase()) : true);
  const filteredLunches = lunches.filter(l => qLunch ? l.name.toLowerCase().includes(qLunch.toLowerCase()) : true);

  // top overview
  const overview = weekDays.map(d => {
    const dinner = getRow(d, 'dinner')?.title || '—';
    const lunch  = getRow(d, 'lunch')?.title || '—';
    return { date: d, label: `${fmtAU(d)} — Dinner: ${dinner} · Lunch: ${lunch}` };
  });

  const generateList = async () => {
    if (!householdId) return alert('No household linked.');
    const { data, error } = await supabase.rpc('create_shopping_list_for_week', { p_household: householdId, p_week_start: weekStart });
    if (error) return alert(error.message);
    window.location.href = `/shopping-list/${data}`;
  };

  return (
    <div className="card">
      <h1>Meal plan — editable</h1>
      <AuthBanner />

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label>Week start (Mon):</label>
        <input type="date" className="border rounded-xl px-3 py-2" value={weekStart} onChange={e=>setWeekStart(e.target.value)} />
        <button className="btn" onClick={resetWeek} disabled={busy}>Reset week</button>
        <button className="btn" onClick={()=>window.print()}>Print week</button>
        <button className="btn-primary btn" onClick={generateList} disabled={busy}>Generate shopping list</button>
      </div>

      {/* Week overview */}
      <div className="border rounded-xl p-3 mb-4">
        <div className="font-medium mb-2">Week overview</div>
        <ul className="space-y-1">
          {overview.map(o => <li key={o.date} className="text-sm">{o.label}</li>)}
        </ul>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {weekDays.map(d => {
          const dinner = getRow(d, 'dinner')?.title || '';
          const lunch  = getRow(d, 'lunch')?.title || '';
          const isEdD = editing?.date === d && editing?.slot === 'dinner';
          const isEdL = editing?.date === d && editing?.slot === 'lunch';

          return (
            <div key={d} className="border rounded-xl p-3">
              <div className="text-sm font-medium mb-2">{fmtAU(d)}</div>

              {/* Dinner */}
              <div className="mb-3">
                <div className="text-sm mb-1"><span className="badge">Dinner</span> {dinner || <em>—</em>}</div>

                {!isEdD ? (
                  dinner
                    ? (
                      <div className="flex gap-2">
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>setEditing({ slot:'dinner', date:d })}>Change</button>
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>clearSlot(d,'dinner')}>Remove</button>
                      </div>
                    )
                    : (
                      <div className="flex">
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>setEditing({ slot:'dinner', date:d })}>Add dinner</button>
                      </div>
                    )
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
                    <div className="mt-2"><button className="btn w-full" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
                  </div>
                )}
              </div>

              {/* Lunch (mirrors dinner — shows chosen lunch + buttons) */}
              <div>
                <div className="text-sm mb-1"><span className="badge">Lunch</span> {lunch || <em>—</em>}</div>

                {!isEdL ? (
                  lunch
                    ? (
                      <div className="flex gap-2">
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>setEditing({ slot:'lunch', date:d })}>Change</button>
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>clearSlot(d,'lunch')}>Remove</button>
                      </div>
                    )
                    : (
                      <div className="flex">
                        <button className="btn flex-1 min-w-[120px] whitespace-nowrap" onClick={()=>setEditing({ slot:'lunch', date:d })}>Add lunch main</button>
                      </div>
                    )
                ) : (
                  <div className="mt-2">
                    <input className="w-full border rounded-xl px-3 py-2 mb-2" placeholder="Search lunch mains…" value={qLunch} onChange={e=>setQLunch(e.target.value)} />
                    <ul className="max-h-48 overflow-auto border rounded-xl">
                      {filteredLunches.map(lc => (
                        <li key={lc.id}>
                          <button disabled={busy} className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={()=>setLunch(d, lc.id)}>{lc.name}</button>
                        </li>
                      ))}
                      {filteredLunches.length===0 && <li className="px-3 py-2 text-sm text-gray-500">No lunch mains</li>}
                    </ul>
                    <div className="mt-2"><button className="btn w-full" onClick={()=>setEditing(null)} disabled={busy}>Cancel</button></div>
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
