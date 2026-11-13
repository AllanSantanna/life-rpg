import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';

afterEach(cleanup);
describe('Radar sincronizado na sessão', () => {
  it('sincroniza missão, XP, cartão e os dois radares; desfaz e preserva filtros independentes', () => {
    render(<App />);
    const baseline = 0;
    const mission = screen.getByRole('checkbox', {
      name: 'Concluir missão: Um passo mais forte',
    });
    const compact = screen.getByRole('figure', {
      name: 'Radar de Evolução · 7 dias',
    });
    expect(within(compact).getByRole('img')).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${baseline} de 100`),
    );
    fireEvent.click(mission);
    const updated = screen.getByRole('progressbar', {
      name: 'Treinos: Dedicação · 7 dias',
    });
    const score = Number(updated.getAttribute('aria-valuenow'));
    expect(score).toBeGreaterThan(baseline);
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
    expect(within(compact).getByRole('img')).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${score} de 100`),
    );
    const nav = within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver Radar de Evolução em Estatísticas',
      }),
    );
    expect(nav.getByRole('button', { name: /Estatísticas/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const panel = within(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    );
    expect(panel.getByRole('img')).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${score} de 100`),
    );
    for (const days of [30, 90]) {
      fireEvent.click(panel.getByRole('button', { name: `${days} dias` }));
      expect(
        panel.getByRole('button', { name: `${days} dias` }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        panel.getByText(new RegExp(`Últimos ${days} dias`)),
      ).toBeInTheDocument();
    }
    fireEvent.click(nav.getByRole('button', { name: /Início/ }));
    expect(
      screen.getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' }),
    ).toHaveAttribute('aria-valuenow', `${score}`);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' }),
    ).toHaveAttribute('aria-valuenow', `${baseline}`);
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(
      screen.getByRole('figure', { name: 'Radar de Evolução · 7 dias' }),
    ).toHaveTextContent(`${baseline}`);
  });
});
