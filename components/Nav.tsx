'use client';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const link = (href: string, label: string) => (
    <Link className={`px-3 py-2 rounded-xl ${pathname===href?'bg-black text-white':'hover:bg-gray-100'}`} href={href}>{label}</Link>
  );
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/sign-in');
  };
  return (
    <nav className="container py-3 flex items-center justify-between">
      <div className="flex gap-2">
        {link('/', 'Home')}
        {link('/recipes', 'Recipes')}
        {link('/lunch', 'Lunch mains')}
        {link('/plan', 'Meal plan')}
      </div>
      <button className="btn" onClick={signOut}>Sign out</button>
    </nav>
  );
}
