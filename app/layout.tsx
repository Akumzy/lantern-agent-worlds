import type { Metadata } from 'next';
import { Atkinson_Hyperlegible, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const body = Atkinson_Hyperlegible({ variable: '--font-body', subsets: ['latin'], weight: ['400', '700'] });
const display = Bricolage_Grotesque({ variable: '--font-display', subsets: ['latin'], weight: ['600', '700', '800'] });
const mono = IBM_Plex_Mono({ variable: '--font-mono', subsets: ['latin'], weight: ['400', '600'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Lantern Arcade — Make a learning world from one sentence',
  description: 'A browser-agent game studio that programs, saves, and runs safe interactive learning worlds through WebMCP.',
  openGraph: {
    title: 'Lantern Arcade — Make a learning world from one sentence',
    description: 'Program and play safe interactive learning worlds with a browser agent and WebMCP.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lantern Arcade fractions bridge game with three of four pieces completed' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lantern Arcade — Make a learning world from one sentence',
    description: 'Program and play safe interactive learning worlds with a browser agent and WebMCP.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable} ${mono.variable}`}>{children}</body></html>;
}
