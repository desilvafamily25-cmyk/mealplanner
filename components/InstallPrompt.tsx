'use client';
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onChange = () => {
      if ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches) {
        setVisible(false);
      }
    };
    window.addEventListener('appinstalled', onChange);
    onChange();
    return () => window.removeEventListener('appinstalled', onChange);
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%]">
      <div className="rounded-2xl border border-gray-300 bg-white p-3 shadow-lg">
        <div className="font-medium mb-1">Install Meal Planner?</div>
        <p className="text-sm text-gray-600 mb-2">
          Add to your home screen for a faster, app-like experience.
        </p>
        <div className="flex gap-2">
          <button className="btn-primary btn" onClick={install}>Install</button>
          <button className="btn" onClick={() => setVisible(false)}>Not now</button>
        </div>
      </div>
    </div>
  );
}
