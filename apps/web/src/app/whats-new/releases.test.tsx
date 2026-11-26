import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from '../../shared/components/Icon';
import {
  latestRelease,
  RELEASE_ID_PATTERN,
  releaseLabel,
  releases,
  type Release,
} from './releases';

const items = releases.flatMap((release) =>
  release.groups.flatMap((group) => group.items),
);

describe('catálogo de Novidades da versão', () => {
  it('tem identificadores de versão únicos, no formato AAAA-MM-DD e em ordem crescente', () => {
    const ids = releases.map((release) => release.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(RELEASE_ID_PATTERN);
      expect(Number.isNaN(Date.parse(`${id}T00:00:00Z`))).toBe(false);
    }
    expect([...ids].sort()).toEqual(ids);
    expect(latestRelease()?.id).toBe(ids[ids.length - 1]);
  });

  it('não repete novidades: cada item tem id único em todo o catálogo', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const titles = releases.flatMap((release) =>
      release.groups.flatMap((group) => group.items.map((item) => item.title)),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('tem títulos e descrições curtos, sem detalhes técnicos', () => {
    expect(items.length).toBeGreaterThan(0);
    for (const release of releases) {
      expect(release.groups.length).toBeGreaterThan(0);
      for (const group of release.groups) {
        expect(group.title.trim()).not.toBe('');
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
    for (const item of items) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.title.length).toBeLessThanOrEqual(32);
      expect(item.description.trim().length).toBeGreaterThan(20);
      expect(item.description.length).toBeLessThanOrEqual(140);
      // Texto para usuários: sem hashes, branches, IndexedDB ou commits.
      expect(`${item.title} ${item.description}`).not.toMatch(
        /\b[0-9a-f]{7,40}\b|feat\/|fix\/|IndexedDB|commit|refactor|localStorage/i,
      );
      // Redação do projeto: sem travessão nem meia-risca.
      expect(item.description).not.toMatch(/[–—]/);
    }
  });

  it('usa somente ícones existentes', () => {
    for (const item of items) {
      const { container, unmount } = render(<Icon name={item.icon} />);
      expect(container.querySelector('path')?.getAttribute('d')).toBeTruthy();
      unmount();
    }
  });

  it('a primeira atualização anuncia apenas o que ainda não estava publicado', () => {
    // Recursos que já estavam na versão publicada (main c897b4e) não entram.
    const first = releases[0]!;
    const ids = first.groups.flatMap((group) => group.items.map((i) => i.id));
    expect(ids).toEqual([
      'quick-actions',
      'voice-commands',
      'finances-single-wallet',
      'finances-recurrences-budgets',
      'finances-history-tools',
      'finances-investment-charts',
    ]);
    const text = JSON.stringify(first);
    for (const published of [
      'Mapa muscular',
      'Backup',
      'Classes',
      'Conquistas',
      'Estatísticas',
      'Cotações',
    ])
      expect(text).not.toContain(published);
  });

  it('aceita versões futuras acrescentadas ao final', () => {
    const next: Release = {
      id: '2027-01-15',
      groups: [
        {
          title: 'Treinos',
          items: [
            {
              id: 'future-item',
              title: 'Novo recurso',
              description: 'Descrição de exemplo para uma versão futura.',
              icon: 'dumbbell',
            },
          ],
        },
      ],
    };
    expect(latestRelease([...releases, next])).toBe(next);
    expect(latestRelease([])).toBeUndefined();
    expect(releaseLabel(next)).toBe('Atualização de janeiro de 2027');
    expect(releaseLabel(releases[0]!)).toBe('Atualização de novembro de 2026');
  });
});
