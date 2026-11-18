# Tipografia

Fontes verificadas em
[index.css](../../apps/web/src/shared/styles/index.css),
[App.tsx](../../apps/web/src/app/App.tsx) e
[SectionHeading.tsx](../../apps/web/src/shared/components/SectionHeading.tsx).

`--font-sans` é `'Inter', ui-sans-serif, system-ui, sans-serif`. A declaração não
carrega a fonte Inter da rede; sem instalação local o navegador usa o fallback.
Metadados e números pontuais usam `font-mono`; não torne todo o aplicativo monoespaçado.

| Contexto existente                     | Padrão                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| Título da página                       | `text-3xl sm:text-4xl`, `font-semibold tracking-tight`      |
| `SectionHeading`                       | `text-xl font-semibold tracking-tight`                      |
| `record-form h2` / `record-section h2` | 18 px, peso 650                                             |
| `strength-stack h3`                    | 18 px, peso 600                                             |
| `eyebrow`                              | 10 px, peso 500, caixa alta, tracking `0.14em`              |
| Texto de apoio da página               | `text-sm leading-relaxed text-muted`                        |
| Rótulos `Field`                        | 12 px                                                       |
| Inputs de registro                     | 14 px; no treino avançado, 16 px                            |
| `CustomSelect`                         | 13 px; `compact`, 12 px                                     |
| `ActionButton`                         | `--text-control` 12 px, peso 600, `--leading-control` 18 px |
| Avisos `record-error`                  | 13 px, entrelinha 1.7                                       |
| Dicas e vazios                         | 12 px, entrelinha 1.8                                       |

Use os utilitários de texto existentes e mantenha a hierarquia h1/h2/h3.
Não escolha tamanhos apenas para encaixar um texto: ajuste o layout e preserve
quebra de linha. Os textos auxiliares de 10/11 px são padrões legados específicos,
não uma regra para reduzir a legibilidade de novos formulários.

Valores de métricas usam `clamp()` em contextos específicos. Tabelas de séries
usam campos de 16 px. Não sobrescreva esses tamanhos com uma regra global de input.
