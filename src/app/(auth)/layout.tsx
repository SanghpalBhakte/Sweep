import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
