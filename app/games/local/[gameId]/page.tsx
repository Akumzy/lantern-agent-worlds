import type { Metadata } from 'next';
import LocalGamePageClient from '../../../../components/LocalGamePageClient';

type PageProps = { params: Promise<{ gameId: string }> };

export const metadata: Metadata = {
  title: 'Saved learning game — Lantern',
  description: 'A learning game saved locally in this browser with Lantern.',
  robots: { index: false, follow: false },
};

export default async function LocalGamePage({ params }: PageProps) {
  const { gameId } = await params;
  return <LocalGamePageClient gameId={gameId} />;
}
