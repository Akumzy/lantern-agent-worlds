'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, FloppyDisk, LightbulbFilament } from '@phosphor-icons/react';
import { demoGames, type GameProject } from '../lib/arcade';
import { readBrowserWorkspace } from '../lib/browser-workspace';
import GamePageClient from './GamePageClient';

export default function LocalGamePageClient({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<GameProject | null | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const workspace = readBrowserWorkspace();
      setGame(workspace?.games.find((item) => item.id === gameId) || null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gameId]);

  if (game) return <GamePageClient game={game} related={demoGames.slice(0, 3)} />;

  return <main className="local-game-state"><Link className="arcade-brand" href="/"><span><LightbulbFilament size={22} weight="fill" /></span><b>Lantern</b></Link><section><FloppyDisk size={34} weight="duotone" /><p>{game === undefined ? 'Opening local game' : 'This game is not saved in this browser'}</p><h1>{game === undefined ? 'Preparing the canvas…' : 'The local draft could not be found.'}</h1><span>{game === undefined ? 'Lantern is reading the game safely from this device.' : 'Return to the builder to resume another saved world or ask your agent to make a new one.'}</span>{game === null && <Link href="/#create"><ArrowLeft size={16} /> Return to the builder</Link>}</section></main>;
}
