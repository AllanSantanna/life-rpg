import { readFileSync } from 'node:fs';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import { testSession, testSet } from '../testFixtures';
import { metricTone } from './model';

afterEach(cleanup);
beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));

// Arquivos-fonte lidos do disco: no Vitest, CSS importado chega vazio.
const read = (path: string) =>
  readFileSync(
    decodeURIComponent(new URL(path, import.meta.url).pathname),
    'utf8',
  );
const theme = read('../../../../shared/styles/index.css');
const mapCss = read('./muscle-map.css');
const effortTones = ['low', 'moderate', 'high', 'very-high'] as const;
const expected = {
  low: '#fff1f1',
  moderate: '#ffb3b3',
  high: '#ff5c5c',
  'very-high': '#e01919',
};

function token(name: string) {
  return new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(theme)?.[1];
}
function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(mapCss)?.[1];
}
function luminance(hex: string) {
  return [1, 3, 5]
    .map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
}

// Peitoral 12 séries (100%), quadríceps 7 (58%), bíceps 4 (33%), panturrilha 1 (8%).
const today = '2026-11-20';
const sessions = (
  [
    ['bench', 12],
    ['extension', 7],
    ['curl', 4],
    ['calf', 1],
  ] as const
).map(([id, sets], i) =>
  testSession(
    `band-${i}`,
    '2026-11-18',
    Array.from({ length: sets }, (_, j) =>
      testSet(`s${j}`, 40, 10, 'working', 2),
    ),
    id,
  ),
);
function surfaces(view: 'frontal' | 'traseira') {
  return [
    ...screen
      .getByRole('group', { name: `Mapa muscular · visão ${view}` })
      .querySelectorAll<SVGPathElement>('[data-surface]'),
  ];
}

describe('escala de cores do esforço relativo', () => {
  it('define as cores oficiais da escala e do indeterminado como tokens do tema', () => {
    for (const tone of effortTones)
      expect(token(`--color-muscle-effort-${tone}`)).toBe(expected[tone]);
    expect(token('--color-muscle-unknown')).toBe('#8a8a8a');
    for (const tone of effortTones)
      expect(rule(`.muscle-tone-${tone}`)).toContain(
        `var(--color-muscle-effort-${tone})`,
      );
    expect(rule('.muscle-tone-unknown')).toContain(
      'var(--color-muscle-unknown)',
    );
  });

  it('ordena a escala do quase branco ao vermelho forte', () => {
    const values = effortTones.map((tone) => luminance(expected[tone]));
    for (let i = 1; i < values.length; i++)
      expect(values[i]).toBeLessThan(values[i - 1]!);
  });

  it('pinta as regiões com a cor sólida da faixa, sem gradiente, mescla ou textura', () => {
    const surface = rule('.muscle-v2-surface');
    expect(surface).toContain('fill: var(--muscle-color)');
    expect(surface).not.toMatch(/opacity|filter|mix-blend-mode|gradient/);
    expect(mapCss).not.toMatch(/mix-blend-mode/);
    expect(rule('.muscle-v2-swatch')).toMatch(
      /background:\s*var\(--muscle-color\)/,
    );
    const { container } = render(
      <MuscleMap sessions={sessions} today={today} period="week" />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    expect(container.querySelector('.muscle-v2 linearGradient')).toBeNull();
    expect(container.querySelector('.muscle-v2-texture')).toBeNull();
    for (const path of [...surfaces('frontal'), ...surfaces('traseira')]) {
      expect(path).not.toHaveAttribute('fill');
      expect(path).not.toHaveAttribute('opacity');
    }
  });

  it('associa cada intensidade à sua faixa e repete a mesma cor na frente e nas costas', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    const byGroup = new Map<string, Set<string>>();
    const seen = new Set<string>();
    for (const path of [...surfaces('frontal'), ...surfaces('traseira')]) {
      const tone = path.dataset.tone!;
      const score = /: (\d+)%/.exec(path.getAttribute('aria-label')!)?.[1];
      expect(tone).toBe(metricTone(score ? Number(score) : null, 'effort'));
      expect(path).toHaveClass(`muscle-tone-${tone}`);
      seen.add(tone);
      const group = path.dataset.group!;
      byGroup.set(group, (byGroup.get(group) ?? new Set()).add(tone));
    }
    expect([...seen].sort()).toEqual(
      ['high', 'low', 'moderate', 'unknown', 'very-high'].sort(),
    );
    // Tríceps, antebraço e panturrilha aparecem nas duas vistas.
    for (const tones of byGroup.values()) expect(tones.size).toBe(1);
    const both = surfaces('traseira').map((p) => p.dataset.group);
    expect(both).toEqual(expect.arrayContaining(['triceps', 'calves']));
  });

  it('usa na legenda as mesmas classes de cor do mapa, em ordem crescente', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    const legend = screen.getByLabelText('Legenda de esforço');
    const items = within(legend).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Baixo1–24%',
      'Moderado25–49%',
      'Alto50–74%',
      'Muito alto75–100%',
      'IndeterminadoSem dados suficientes',
    ]);
    const swatchTones = items.map(
      (li) =>
        /muscle-tone-([\w-]+)/.exec(
          li.querySelector('.muscle-v2-swatch')!.getAttribute('class')!,
        )![1],
    );
    expect(swatchTones).toEqual([...effortTones, 'unknown']);
    const mapTones = new Set(surfaces('frontal').map((p) => p.dataset.tone));
    for (const tone of mapTones) expect(swatchTones).toContain(tone);
  });

  it('destaca com contorno duplo tanto regiões quase brancas quanto vermelho forte', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    const front = screen.getByRole('group', {
      name: 'Mapa muscular · visão frontal',
    });
    for (const [name, tone] of [
      [/Panturrilha · esquerda/, 'low'],
      [/Peitoral · esquerda/, 'very-high'],
    ] as const) {
      const region = within(front).getByRole('button', { name });
      fireEvent.keyDown(region, { key: 'Enter' });
      expect(region).toHaveAttribute('aria-pressed', 'true');
      expect(region.dataset.tone).toBe(tone);
      const overlay = front.querySelectorAll('.muscle-v2-selection');
      expect(overlay).toHaveLength(1);
      const [selection] = overlay;
      expect(selection).toHaveAttribute('aria-hidden', 'true');
      const halo = selection!.querySelector('.muscle-v2-selection-halo');
      const line = selection!.querySelector('.muscle-v2-selection-line');
      expect(halo).toHaveAttribute('d', region.getAttribute('d'));
      expect(line).toHaveAttribute('d', region.getAttribute('d'));
    }
    expect(rule('.muscle-v2-selection-halo')).toContain(
      'var(--color-background)',
    );
    expect(rule('.muscle-v2-selection-line')).toContain(
      'var(--color-foreground)',
    );
  });

  it('preserva os percentuais calculados e os limites das faixas', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    const front = screen.getByRole('group', {
      name: 'Mapa muscular · visão frontal',
    });
    for (const label of [
      /Peitoral · esquerda da imagem: 100% · Muito alto/,
      /Quadríceps · esquerda da imagem: 58% · Alto/,
      /Bíceps · esquerda da imagem: 33% · Moderado/,
      /Panturrilha · esquerda da imagem: 8% · Baixo/,
    ])
      expect(
        within(front).getAllByRole('button', { name: label }).length,
      ).toBeGreaterThan(0);
    expect(
      [1, 24, 25, 49, 50, 74, 75, 100, null].map((v) =>
        metricTone(v, 'effort'),
      ),
    ).toEqual([
      'low',
      'low',
      'moderate',
      'moderate',
      'high',
      'high',
      'very-high',
      'very-high',
      'unknown',
    ]);
  });
});
