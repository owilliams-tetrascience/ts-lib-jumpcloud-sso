import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ADMIN_GROUP } from '../groups';

export const metadata: Metadata = {
  title: 'jumpcloud-sso — Next.js example',
  description:
    'Minimal Next.js App Router app using @tetrascience-npm/jumpcloud-sso/next',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '42rem',
          margin: '2rem auto',
          padding: '0 1rem',
          lineHeight: 1.6,
        }}
      >
        <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <a href="/">Home (public)</a>
          <a href="/dashboard">Dashboard (any signed-in user)</a>
          <a href="/admin">Admin ({ADMIN_GROUP} only)</a>
          {process.env.NODE_ENV === 'production' ? null : (
            <a href="/debug">Claim debug (dev)</a>
          )}
        </nav>
        {children}
      </body>
    </html>
  );
}
