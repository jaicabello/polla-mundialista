'use client';

import { useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

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
