'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('demo@family.test');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState<string|null>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push('/');
  };

  return (
    <div className="card max-w-md mx-auto">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded-xl px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border rounded-xl px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary btn w-full" type="submit">Sign in</button>
      </form>
    </div>
  );
}
