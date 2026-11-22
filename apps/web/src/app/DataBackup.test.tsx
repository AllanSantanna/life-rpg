import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listBackups } from '../shared/storage/backups';
import {
  projectCharacter,
  reconcileCharacter,
} from '../modules/profile/character';
import { syntheticPlayer } from '../test/backupFixtures';
import { App } from './App';
import {
  createBackupFile,
  readFileText,
  type BackupFileV1,
} from './backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from './playerState';

// jsdom isolado: o localStorage daqui nunca é o do navegador real. Os dados
// são sintéticos. Transações nativas: scripts/audit-backup.mjs (Chromium).
const envelope = (data: unknown, version = PLAYER_STORAGE_VERSION) =>
  JSON.stringify({ version, data });
const stored = () => localStorage.getItem(PLAYER_STORAGE_KEY);
const backupText = (data: PlayerState) =>
  createBackupFile(envelope(data), new Date(2026, 10, 12, 9)).content;
const today = '2026-11-13';
let downloads: { name: string; blob: Blob }[] = [];

beforeEach(() => {
  downloads = [];
  let pendingName = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    pendingName = this.download;
  });
  URL.createObjectURL = vi.fn((blob: Blob) => {
    queueMicrotask(() => downloads.push({ name: pendingName, blob }));
    return 'blob:life-rpg-test';
  });
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function openProfile() {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name: 'Perfil' }),
  );
  return screen.getByRole('region', { name: 'Backup de dados' });
}
function choose(section: HTMLElement, text: string, name = 'backup.json') {
  const input = section.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File([text], name, { type: 'application/json' })] },
  });
}
const preview = () => screen.findByRole('group', { name: 'Prévia do backup' });

describe('Backup de dados no Perfil', () => {
  it('apresenta exportação e importação e informa que não há sincronização', () => {
    render(<App />);
    const section = openProfile();
    expect(
      within(section).getByText(
        /Os dispositivos não são sincronizados automaticamente/,
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        'Salve uma cópia dos seus dados para guardar ou transferir para outro dispositivo.',
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        'Restaure seus registros a partir de um arquivo de backup do Life RPG.',
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole('button', { name: 'Exportar dados' }),
    ).toBeEnabled();
    expect(
      within(section).getByRole('button', { name: 'Importar dados' }),
    ).toBeEnabled();
  });

  it('não exporta quando ainda não há registros confirmados', async () => {
    render(<App />);
    const section = openProfile();
    fireEvent.click(
      within(section).getByRole('button', { name: 'Exportar dados' }),
    );
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Ainda não há registros confirmados',
    );
    expect(downloads).toHaveLength(0);
  });

  it('exporta o estado confirmado no armazenamento como arquivo JSON', async () => {
    const player = syntheticPlayer();
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(player));
    render(<App />);
    const section = openProfile();
    fireEvent.click(
      within(section).getByRole('button', { name: 'Exportar dados' }),
    );
    expect(await within(section).findByRole('status')).toHaveTextContent(
      /Download de life-rpg-backup-2026-11-13\.json iniciado/,
    );
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]!.name).toBe('life-rpg-backup-2026-11-13.json');
    const file = JSON.parse(
      await readFileText(downloads[0]!.blob),
    ) as BackupFileV1;
    expect(file.format).toBe('life-rpg-backup');
    expect(file.payload).toEqual(JSON.parse(stored()!));
  });

  it('cancelar a importação não altera nenhum dado', async () => {
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(syntheticPlayer()));
    render(<App />);
    const section = openProfile();
    // Após a abertura (inclui a reconciliação de classe já existente).
    const current = stored();
    const other = syntheticPlayer();
    other.profile.name = 'Outro dispositivo';
    choose(section, backupText(other));
    const group = await preview();
    expect(within(group).getByText('Outro dispositivo')).toBeInTheDocument();
    expect(
      within(group).getByText(
        'Os dados atuais deste dispositivo serão substituídos pelos dados do arquivo selecionado. Uma cópia de recuperação será preservada.',
      ),
    ).toBeInTheDocument();
    const cancel = within(group).getByRole('button', { name: 'Cancelar' });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(
      screen.queryByRole('group', { name: 'Prévia do backup' }),
    ).toBeNull();
    expect(
      within(section).getByRole('button', { name: 'Importar dados' }),
    ).toHaveFocus();
    expect(stored()).toBe(current);
    expect(listBackups(localStorage, PLAYER_STORAGE_KEY)).toHaveLength(0);
  });

  it('Escape também cancela a prévia', async () => {
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(syntheticPlayer()));
    render(<App />);
    const section = openProfile();
    choose(section, backupText(syntheticPlayer()));
    fireEvent.keyDown(await preview(), { key: 'Escape' });
    expect(
      screen.queryByRole('group', { name: 'Prévia do backup' }),
    ).toBeNull();
    expect(within(section).getByRole('status')).toHaveTextContent(
      'Importação cancelada',
    );
  });

  it('restaura o backup, preserva a cópia anterior e permite exportar de novo', async () => {
    const previous = createInitialPlayerState();
    previous.profile.name = 'Dispositivo atual';
    const previousRaw = envelope(previous);
    localStorage.setItem(PLAYER_STORAGE_KEY, previousRaw);
    render(<App />);
    let section = openProfile();
    // Um export real já contém a classe reconciliada pelo app.
    const raw = syntheticPlayer(4);
    const incoming = reconcileCharacter(raw, projectCharacter(raw, today));
    const original = backupText(incoming);
    choose(section, original, 'life-rpg-backup-2026-11-12.json');
    const group = await preview();
    expect(within(group).getByText(/12 movimentações/)).toBeInTheDocument();
    fireEvent.click(
      within(group).getByRole('button', { name: 'Restaurar backup' }),
    );
    section = screen.getByRole('region', { name: 'Backup de dados' });
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Backup restaurado',
    );
    const data = JSON.parse(stored()!).data as PlayerState;
    expect(data.records).toEqual(incoming.records);
    expect(data.goals).toEqual(incoming.goals);
    // Formulário do Perfil remontado com o nome restaurado.
    expect(
      screen.getByRole('textbox', { name: 'Nome do jogador' }),
    ).toHaveValue('Jogador Sintético');
    // Cópia recuperável do estado anterior, visível no Perfil.
    const [copy] = listBackups(localStorage, PLAYER_STORAGE_KEY);
    expect(localStorage.getItem(copy!.key)).toBe(previousRaw);
    expect(
      await screen.findByRole('region', {
        name: 'Cópias de segurança dos registros',
      }),
    ).toBeInTheDocument();
    // Exportar após importar: mesmo conteúdo, exceto o instante da exportação.
    fireEvent.click(
      within(section).getByRole('button', { name: 'Exportar dados' }),
    );
    await waitFor(() => expect(downloads).toHaveLength(1));
    const again = JSON.parse(
      await readFileText(downloads[0]!.blob),
    ) as BackupFileV1;
    const first = JSON.parse(original) as BackupFileV1;
    expect({ ...again, exportedAt: '' }).toEqual({ ...first, exportedAt: '' });
  });

  it.each([
    ['inválido', '{"foo":1}', 'não é um backup do Life RPG'],
    ['corrompido', '{"format":"life-rpg-backup",', 'corrompido'],
    [
      'de versão futura',
      envelope(createInitialPlayerState(), PLAYER_STORAGE_VERSION + 1),
      'formato mais novo',
    ],
  ])('recusa arquivo %s sem alterar os dados', async (_name, text, error) => {
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(syntheticPlayer()));
    render(<App />);
    const section = openProfile();
    // Após a abertura (inclui a reconciliação de classe já existente).
    const current = stored();
    choose(section, text);
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      new RegExp(error),
    );
    expect(
      screen.queryByRole('group', { name: 'Prévia do backup' }),
    ).toBeNull();
    expect(stored()).toBe(current);
  });

  it('não sobrescreve dados alterados por outra aba durante a confirmação', async () => {
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(syntheticPlayer()));
    render(<App />);
    const section = openProfile();
    choose(section, backupText(createInitialPlayerState()));
    const group = await preview();
    // Outra aba grava depois da prévia e antes da confirmação.
    const otherTab = syntheticPlayer(2);
    otherTab.profile.name = 'Gravado em outra aba';
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(otherTab));
    fireEvent.click(
      within(group).getByRole('button', { name: 'Restaurar backup' }),
    );
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'alterados em outra aba',
    );
    expect(JSON.parse(stored()!).data.profile.name).toBe(
      'Gravado em outra aba',
    );
    expect(listBackups(localStorage, PLAYER_STORAGE_KEY)).toHaveLength(0);
  });

  it('falha na restauração mantém o estado anterior íntegro', async () => {
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(syntheticPlayer()));
    render(<App />);
    const section = openProfile();
    // Após a abertura (inclui a reconciliação de classe já existente).
    const current = stored();
    choose(section, backupText(createInitialPlayerState()));
    const group = await preview();
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === PLAYER_STORAGE_KEY) throw new Error('quota');
      original.call(this, key, value);
    });
    fireEvent.click(
      within(group).getByRole('button', { name: 'Restaurar backup' }),
    );
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Os registros anteriores foram preservados',
    );
    expect(stored()).toBe(current);
  });

  it('substitui registros protegidos guardando o original', async () => {
    const protectedRaw = envelope({ broken: true });
    localStorage.setItem(PLAYER_STORAGE_KEY, protectedRaw);
    render(<App />);
    const section = openProfile();
    fireEvent.click(
      within(section).getByRole('button', { name: 'Exportar dados' }),
    );
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'protegidos',
    );
    choose(section, backupText(syntheticPlayer()));
    fireEvent.click(
      within(await preview()).getByRole('button', { name: 'Restaurar backup' }),
    );
    await waitFor(() =>
      expect(JSON.parse(stored()!).data.profile.name).toBe('Jogador Sintético'),
    );
    const [copy] = listBackups(localStorage, PLAYER_STORAGE_KEY);
    expect(localStorage.getItem(copy!.key)).toBe(protectedRaw);
  });
});
