import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerPortrait } from './PlayerPortrait';
import { playerPortrait } from './portraits';
import { classCard } from './classCards';
import { createInitialPlayerState } from '../../app/playerState';
import { PlayerHeader } from './PlayerHeader';
import { initialCharacter } from './character';
import type { ClassId } from './classes';
import {
  portraitStage,
  type PortraitCharacter,
  type PortraitStage,
} from './portraits';

afterEach(cleanup);
const classes: [ClassId | null, string, string][] = [
  [null, 'aventureiro', 'Aventureiro'],
  ['warrior', 'guerreiro', 'Guerreiro'],
  ['strategist', 'estrategista', 'Estrategista'],
  ['guardian', 'guardiao', 'Guardião'],
  ['sage', 'sabio', 'Sábio'],
  ['master', 'mestre', 'Mestre'],
];
const stages = [
  { level: 1, stage: 1, label: 'Inicial' },
  { level: 5, stage: 2, label: 'Experiente' },
  { level: 10, stage: 3, label: 'Avançado' },
  { level: 20, stage: 4, label: 'Elite' },
];
describe.each(classes)('Retratos de %s', (classId, slug, className) => {
  it.each(stages)(
    'seleciona estágio $stage no nível $level',
    ({ level, stage, label }) => {
      render(<PlayerPortrait classId={classId} level={level} name="Lia" />);
      const image = screen.getByRole('img', { name: 'Avatar de Lia' });
      expect(image).toHaveAttribute(
        'src',
        expect.stringContaining(`${slug}-nivel-${stage}.webp`),
      );
      expect(image).toHaveAccessibleDescription(
        `${className} · estágio ${stage}, ${label}`,
      );
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    },
  );
});
it.each([
  [1, 1],
  [4, 1],
  [5, 2],
  [9, 2],
  [10, 3],
  [19, 3],
  [20, 4],
  [99, 4],
])('aplica o limite visual no nível %i', (level, stage) => {
  expect(portraitStage(level)).toBe(stage);
});
it('deriva o retrato da classe e do nível recebidos, sem redefinir XP ou mudar o personagem', () => {
  const character = initialCharacter();
  const original = structuredClone(character);
  const props = {
    player: { ...createInitialPlayerState().profile, name: 'Lia' },
    character,
    progress: { level: 4, xp: 1900, xpPerLevel: 2000 },
    dedication: { Finanças: 0, Treinos: 0, Descanso: 0, Conhecimento: 0 },
    onOpenEvolution: vi.fn(),
  };
  const app = render(<PlayerHeader {...props} />);
  expect(screen.getByText('Sem classe definida')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Avatar de Lia' })).toHaveAttribute(
    'src',
    expect.stringContaining('aventureiro-nivel-1'),
  );
  const next = {
    ...props,
    character: {
      ...character,
      classification: {
        ...character.classification,
        current: 'warrior' as const,
      },
    },
    progress: { ...props.progress, level: 5, xp: 0 },
  };
  app.rerender(<PlayerHeader {...next} />);
  expect(screen.getByRole('img', { name: 'Avatar de Lia' })).toHaveAttribute(
    'src',
    expect.stringContaining('guerreiro-nivel-2'),
  );
  expect(
    screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
  ).toHaveAttribute('aria-valuenow', '0');
  app.rerender(
    <PlayerHeader
      {...next}
      character={{
        ...next.character,
        classification: { ...next.character.classification, current: 'sage' },
      }}
    />,
  );
  expect(screen.getByRole('img', { name: 'Avatar de Lia' })).toHaveAttribute(
    'src',
    expect.stringContaining('sabio-nivel-2'),
  );
  expect(screen.getByText('Sábio')).toBeInTheDocument();
  expect(character).toEqual(original);
});

describe('Arte de fantasia sombria', () => {
  it('retrato e galeria usam a mesma carta por classe e estágio, nunca a arte legada', () => {
    for (const [classId, slug] of classes) {
      for (const { level, stage } of stages) {
        const portrait = playerPortrait(classId, level);
        const card = classCard(
          slug as PortraitCharacter,
          stage as PortraitStage,
        );
        expect(portrait.src).toBe(card.src);
        expect(portrait.src).toContain(
          `cards/${slug}/${slug}-nivel-${stage}.webp`,
        );
        expect(portrait.src).not.toContain('legacy');
        expect([portrait.width, portrait.height]).toEqual([
          card.width,
          card.height,
        ]);
        // Proporção de carta (retrato), sem ampliação além do original.
        expect(card.height / card.width).toBeGreaterThan(1.3);
        expect(card.width).toBeLessThanOrEqual(200);
      }
    }
  });
});
