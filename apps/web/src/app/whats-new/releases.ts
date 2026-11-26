import type { IconName } from '../../shared/components/Icon';

/**
 * Catálogo das Novidades da versão. Faz parte do build: o aplicativo não
 * consulta o GitHub nem gera changelog no navegador.
 *
 * Para anunciar uma atualização, acrescente uma entrada ao FINAL da lista com
 * um `id` novo no formato `AAAA-MM-DD` (data em que a entrada foi preparada).
 * O identificador cresce com o tempo: a janela abre quando a última entrada é
 * mais recente que a já apresentada. Atualizações sem novidades relevantes não
 * recebem entrada. Detalhes em `README.md` desta pasta.
 */
export interface ReleaseItem {
  /** Identificador único em todo o catálogo (impede anunciar duas vezes). */
  id: string;
  title: string;
  description: string;
  icon: IconName;
}
export interface ReleaseGroup {
  title: string;
  items: readonly ReleaseItem[];
}
export interface Release {
  /** `AAAA-MM-DD`; nunca um hash de commit nem um número técnico. */
  id: string;
  groups: readonly ReleaseGroup[];
}

export const RELEASE_ID_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const releases: readonly Release[] = [
  {
    // Primeira atualização após a versão publicada em `main` (c897b4e):
    // carteira única, recorrências e orçamento, ajuda contextual, pizza de
    // distribuição, custo × valor, Ações rápidas e comando por voz.
    id: '2026-11-26',
    groups: [
      {
        title: 'Registros',
        items: [
          {
            id: 'quick-actions',
            title: 'Ações rápidas',
            description:
              'Toque em + para registrar treino, sono, leitura ou finanças de qualquer página, com menos cliques.',
            icon: 'plus',
          },
          {
            id: 'voice-commands',
            title: 'Comandos por voz',
            description:
              'Diga, por exemplo, “Dormi sete horas”. Você revisa o registro antes de salvar e também pode digitar a frase.',
            icon: 'mic',
          },
        ],
      },
      {
        title: 'Finanças',
        items: [
          {
            id: 'finances-single-wallet',
            title: 'Finanças reorganizadas',
            description:
              'Carteira única com saldo automático, abas Carteira e Investimentos e explicações nos botões “?”.',
            icon: 'wallet',
          },
          {
            id: 'finances-recurrences-budgets',
            title: 'Recorrências e orçamento',
            description:
              'Programe receitas e despesas periódicas, confirme cada ocorrência e defina limites mensais por categoria.',
            icon: 'calendar',
          },
          {
            id: 'finances-history-tools',
            title: 'Histórico mais prático',
            description:
              'Pesquise movimentações, repita uma receita ou despesa e escolha entre as categorias recentes.',
            icon: 'search',
          },
          {
            id: 'finances-investment-charts',
            title: 'Investimentos mais claros',
            description:
              'Distribuição em pizza, custo × valor em vermelho quando abaixo do custo e resgates informando só o valor.',
            icon: 'chart',
          },
        ],
      },
    ],
  },
];

/** Entrada mais recente do catálogo (a última), ou `undefined` se vazio. */
export const latestRelease = (
  catalog: readonly Release[] = releases,
): Release | undefined => catalog[catalog.length - 1];

const months = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
/** Rótulo visível da atualização (ex.: “Atualização de novembro de 2026”). */
export function releaseLabel(release: Release): string {
  const [year, month] = release.id.split('-');
  return `Atualização de ${months[Number(month) - 1]} de ${year}`;
}
