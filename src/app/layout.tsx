import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "./theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polla Mundialista",
  description: "Quiniela automatizada para la fase eliminatoria del Mundial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-zinc-200 dark:bg-zinc-900/90 dark:border-zinc-800">
          <nav className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
            <Link
              href="/"
              className="font-bold text-lg tracking-tight dark:text-white"
            >
              ⚽ Polla Mundialista
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Ranking
              </Link>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Fixture
              </Link>
              <Link
                href="/pronosticos"
                className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Pronósticos
              </Link>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}


