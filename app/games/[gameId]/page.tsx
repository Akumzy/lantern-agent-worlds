import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GamePageClient from '../../../components/GamePageClient';
import { demoGames } from '../../../lib/arcade';

type PageProps = { params: Promise<{ gameId: string }> };

export function generateStaticParams() {
  return demoGames.map((game) => ({ gameId: game.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameId } = await params;
  const game = demoGames.find((item) => item.id === gameId);
  if (!game) return {};
  const description = `${game.description} Learning goal: ${game.learningGoal}.`;
  return {
    title: `${game.title} — Play on Lantern`,
    description,
    openGraph: { title: `${game.title} — Play on Lantern`, description, images: [] },
    twitter: { card: 'summary', title: `${game.title} — Play on Lantern`, description, images: [] },
  };
}

export default async function GamePage({ params }: PageProps) {
  const { gameId } = await params;
  const game = demoGames.find((item) => item.id === gameId);
  if (!game) notFound();
  return <GamePageClient game={game} related={demoGames.filter((item) => item.id !== game.id).slice(0, 3)} />;
}
