import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

// Interações locais, sem chamadas de rede. O armazenamento é isolado por teste.
afterEach(cleanup);
function navigate(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
describe('Dashboard do jogador', () => {
  it('apresenta jogador, atributos, quatro pilares e conquistas', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Visão geral' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Avatar de Jogador' }),
    ).toBeInTheDocument();
    for (const name of ['Força', 'Disciplina', 'Conhecimento', 'Riqueza']) {
      expect(screen.getByRole('progressbar', { name })).toBeInTheDocument();
    }
    for (const name of ['Finanças', 'Treinos', 'Descanso', 'Conhecimento']) {
      expect(
        within(
          screen.getByRole('region', { name: 'Pilares da jornada' }),
        ).getByRole('heading', { name }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole('region', { name: 'Conquistas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });
  it('não mostra missões fixas, modelos ou um painel vazio de quests', () => {
    render(<App />);
    expect(screen.queryByText('Missões da jornada')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Missões' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Minhas Quests' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Quests sugeridas')).not.toBeInTheDocument();
    const achievements = screen.getByRole('region', { name: 'Conquistas' });
    expect(achievements.parentElement?.children).toHaveLength(1);
    expect(achievements.parentElement).not.toHaveClass(
      'dashboard-secondary--with-goals',
    );
    navigate('Quests');
    expect(
      screen.getByRole('button', { name: 'Criar minha quest' }),
    ).toBeInTheDocument();
  });
});
