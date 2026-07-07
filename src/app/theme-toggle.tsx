'use client';

import { useState, useLayoutEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    setDark(isDark);
  }, []);

  return (
    <button
      onClick={() => {
        const next = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
        setDark(next);
      }}
      className="ml-2 p-2 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Cambiar tema"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
