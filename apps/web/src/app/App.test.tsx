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
      screen.getByRole('img', { name: 'Avatar de Allan' }),
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
    ).toHaveAttribute('aria-valuenow', '1640');
  });
  it('conclui e desfaz missões sem acumular XP duplicado', () => {
    render(<App />);
    const mission = screen.getByRole('checkbox', {
      name: 'Concluir missão: Um passo mais forte',
    });
    const xp = screen.getByRole('progressbar', {
      name: 'Experiência do jogador',
    });
    fireEvent.click(mission);
    expect(mission).toBeChecked();
    expect(xp).toHaveAttribute('aria-valuenow', '1790');
    expect(screen.getByRole('status')).toHaveTextContent('Você ganhou 150 XP');
    fireEvent.click(mission);
    expect(mission).not.toBeChecked();
    expect(xp).toHaveAttribute('aria-valuenow', '1640');
    fireEvent.click(mission);
    expect(xp).toHaveAttribute('aria-valuenow', '1790');
  });
  it('navega, filtra missões e mantém o progresso ao trocar de seção', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(
      screen.getByRole('heading', { name: 'Suas missões' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pendentes' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Concluídas' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    navigate('Início');
    expect(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '1790');
    navigate('Estatísticas');
    expect(
      screen.getByRole('heading', { name: 'Sua evolução' }),
    ).toBeInTheDocument();
    navigate('Perfil');
    expect(
      screen.getByRole('heading', { name: 'Seu personagem' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perfil/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('projeta mudança de nível e permite revertê-la nesta demonstração', () => {
    render(<App />);
    for (const mission of screen.getAllByRole('checkbox')) {
      if (!(mission as HTMLInputElement).checked) fireEvent.click(mission);
    }
    expect(screen.getByText('Explorador', { exact: false })).toHaveTextContent(
      'Nível 13',
    );
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '90');
    expect(screen.getByText(/Todas as missões concluídas/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    );
    expect(screen.getByText('Explorador', { exact: false })).toHaveTextContent(
      'Nível 12',
    );
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '1940');
  });
  it('preserva os dados quando a aplicação é recarregada', () => {
    const { unmount } = render(<App />);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    );
    unmount();
    render(<App />);
    expect(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    ).toBeChecked();
  });
});
