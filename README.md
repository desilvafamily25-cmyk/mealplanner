# Meal Planner — Next.js Starter

## Setup
1. Create `.env.local` from example:
   ```bash
   cp .env.local.example .env.local
   ```
   Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API.

2. Install & run:
   ```bash
   npm install
   npm run dev
   ```

3. Sign in with your demo user (`demo@family.test` / `Demo1234!`).

## SQL helpers to add (run once)
Add this RPC to fetch the current user's household id:
```sql
create or replace function get_my_household()
returns uuid
language sql
security definer
set search_path = public
as $$
  select hm.household_id
  from household_members hm
  where hm.user_id = auth.uid()
  limit 1
$$;
```
