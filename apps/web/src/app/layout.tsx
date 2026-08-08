import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'RUMA',
  description: "Your family's second brain — AI-powered Household Operating System",
  icons: {
    icon: [{ url: '/brand/ruma-mark-mono.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/ruma-mark.svg' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
