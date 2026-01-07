import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import { AppNav } from '@/components/AppNav';

export const metadata: Metadata = {
  title: 'MCMP',
  description: 'Music Campaign Marketplace Platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <AuthProvider>
          <div style={{ padding: 24 }}>
            <AppNav />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
