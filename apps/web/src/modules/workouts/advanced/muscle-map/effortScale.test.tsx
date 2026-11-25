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
// Paleta do mapa: recuperação original (e7b7b83); esforço do cinza ao vermelho escuro.
const palette: Record<string, string> = {
  unknown: 'var(--color-muted)',
  low: 'color-mix(in srgb, var(--color-focus) 55%, var(--color-muted))',
  moderate: 'var(--color-workouts)',
  high: 'var(--color-primary)',
  'very-high': 'var(--color-action-end)',
  ready: 'var(--color-muscle-ready)',
  recovering: 'var(--color-muscle-recovering)',
  tired: 'var(--color-muscle-tired)',
  fatigued: 'var(--color-primary)',
};

function token(name: string) {
  return new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(theme)?.[1];
}
function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`)
    .exec(mapCss)?.[1]
    ?.replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}
function hex(color: string) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}
function luminance([r, g, b]: number[]) {
  return [r!, g!, b!]
    .map((v) => {
      const c = v / 255;
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
  it('usa tokens existentes nos dois modos, com classes separadas por modo', () => {
    for (const [tone, color] of Object.entries(palette))
      expect(rule(`.muscle-tone-${tone}`)).toBe(` --muscle-color: ${color}; `);
    expect(token('--color-focus')).toBe('#fca5a5');
    expect(token('--color-workouts')).toBe('#ed8989');
    expect(token('--color-primary')).toBe('#dc2626');
    expect(token('--color-action-end')).toBe('#a61920');
    expect(token('--color-muted')).toBe('#a3a3a3');
    expect(token('--color-muscle-ready')).toBe('#22c55e');
    expect(token('--color-muscle-recovering')).toBe('#eab308');
    expect(token('--color-muscle-tired')).toBe('#f97316');
    expect(theme).not.toMatch(/--color-muscle-effort-|--color-muscle-unknown/);
  });

  it('parte do cinza e vai do mais claro ao mais escuro no esforço', () => {
    const [focus, muted] = [hex('#fca5a5'), hex('#a3a3a3')];
    const low = focus.map((c, i) => c * 0.55 + muted[i]! * 0.45);
    const values = [low, hex('#ed8989'), hex('#dc2626'), hex('#a61920')].map(
      luminance,
    );
    for (let i = 1; i < values.length; i++)
      expect(values[i]).toBeLessThan(values[i - 1]!);
    // Baixo é um rosa acinzentado mais claro que o cinza indeterminado.
    expect(values[0]).toBeGreaterThan(luminance(muted));
  });

  it('restaura gradientes, sombras e textura anatômica das regiões e da legenda', () => {
    expect(rule('.muscle-v2-color')).toBe(' stop-color: var(--muscle-color); ');
    expect(rule('.muscle-v2-shade')).toContain(
      'color-mix(in srgb, var(--muscle-color) 36%, var(--color-background))',
    );
    expect(rule('.muscle-v2-texture')).toContain('mix-blend-mode: soft-light');
    expect(rule('.muscle-v2-texture')).toContain('opacity: 0.8');
    expect(rule('.muscle-v2-surface')).not.toMatch(/(^|[ ;])fill:/);
    expect(rule('.muscle-v2-swatch')).toContain(
      'linear-gradient(var(--muscle-color), color-mix(in srgb, var(--muscle-color) 30%, var(--color-background)))',
    );
    const { container } = render(
      <MuscleMap sessions={sessions} today={today} period="week" />,
    );
    for (const mode of ['Esforço', 'Recuperação']) {
      fireEvent.click(screen.getByRole('tab', { name: mode }));
      for (const view of ['frontal', 'traseira'] as const) {
        const group = screen.getByRole('group', {
          name: `Mapa muscular · visão ${view}`,
        });
        expect(group.querySelectorAll('.muscle-v2-texture')).toHaveLength(1);
        for (const path of surfaces(view)) {
          const id = /^url\(#(.+)\)$/.exec(path.getAttribute('fill')!)![1]!;
          const gradient = container.querySelector(`[id="${id}"]`)!;
          expect(gradient.tagName).toBe('linearGradient');
          expect(gradient).toHaveClass(`muscle-tone-${path.dataset.tone}`);
          expect(
            [...gradient.querySelectorAll('stop')].map(
              (stop) => stop.className.baseVal,
            ),
          ).toEqual(['muscle-v2-shade', 'muscle-v2-color', 'muscle-v2-shade']);
        }
      }
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
      'IndeterminadoSem dados suficientes',
      'EstabilizadorParticipação não quantificada',
      'Baixo1–24%',
      'Moderado25–49%',
      'Alto50–74%',
      'Muito alto75–100%',
    ]);
    const swatchTones = items.map(
      (li) =>
        /muscle-tone-([\w-]+)/.exec(
          li.querySelector('.muscle-v2-swatch')!.getAttribute('class')!,
        )![1],
    );
    expect(swatchTones).toEqual(['unknown', 'stabilizer', ...effortTones]);
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
