'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AuthBanner() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  if (authed === null || authed) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3">
      <div className="font-medium">Sign in required</div>
      <div className="text-sm">
        Please <Link className="underline" href="/sign-in">sign in</Link> to view your family’s recipes, lunch mains, and meal plan.
      </div>
    </div>
  );
}
