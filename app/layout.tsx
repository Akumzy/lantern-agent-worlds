import type { Metadata } from 'next';
import { Geist, Space_Grotesk } from 'next/font/google';
import './globals.css';

const body = Geist({ variable: '--font-body', subsets: ['latin'] });
const display = Space_Grotesk({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Lantern — Enter the lesson',
  description: 'A WebMCP-native learning world where AI agents build interactive 3D courses, simulations, missions, and assessments.',
  openGraph: {
    title: 'Lantern — Enter the lesson',
    description: 'AI agents build interactive 3D courses, simulations, missions, and assessments in a shared learning world.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lantern learning paths illuminated by an agent-ready course workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lantern — Enter the lesson',
    description: 'AI agents build interactive 3D courses, simulations, missions, and assessments in a shared learning world.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>;
}
