# Novidades da versão

Janela que apresenta, uma única vez por atualização, as principais melhorias a
quem já usava o Life RPG. Pode ser fechada imediatamente; não é tutorial nem
onboarding. Funciona offline: o conteúdo faz parte do build, sem backend nem
consulta ao GitHub.

| Arquivo                 | Responsabilidade                                                    |
| ----------------------- | ------------------------------------------------------------------- |
| `releases.ts`           | Catálogo versionado das novidades                                   |
| `whatsNewPreference.ts` | Preferência local `life-rpg:whats-new` (última versão apresentada)  |
| `presentation.ts`       | Regras puras: decisão, sinais de uso anterior e interface ocupada   |
| `useWhatsNew.ts`        | Decisão única após o carregamento, adiamento, abertura e fechamento |
| `WhatsNewDialog.tsx`    | Janela (modal nativo `<dialog>`, mesmo padrão dos demais diálogos)  |
| `WhatsNewEntry.tsx`     | Acesso “Ver novidades” no Perfil                                    |

## Como anunciar uma nova atualização

1. Acrescente uma entrada **ao final** de `releases` em `releases.ts`.
2. Use como `id` a data em que a entrada foi preparada, no formato `AAAA-MM-DD`
   (maior que a anterior). O rótulo visível (“Atualização de novembro de
   2026”) é derivado dele; nunca use hash de commit ou nome de branch.
3. Agrupe as novidades (`groups`) e escreva para usuários: título curto,
   descrição de até 140 caracteres e um ícone existente (`IconName`). Cada item
   tem `id` único em todo o catálogo, o que impede anunciar algo duas vezes.
4. Anuncie apenas o que ainda não estava publicado; refatorações, testes e
   dependências ficam de fora. Atualizações sem novidades relevantes não
   recebem entrada e, por isso, não abrem a janela.
5. Publique. `releases.test.tsx` valida formato, ordem, unicidade, textos e
   ícones.

## Quando a janela aparece

A decisão é tomada **uma vez por carregamento**, quando os registros já foram
lidos e validados (persistência `saved`/`saving`), com o estado daquele momento:

| Situação                                                         | Resultado                                  |
| ---------------------------------------------------------------- | ------------------------------------------ |
| Preferência igual ou posterior à última entrada                  | Nada acontece                              |
| Preferência anterior (já usava o aplicativo)                     | Abre a janela                              |
| Sem preferência e com registros, Quests, nome ou meta própria    | Abre a janela (usuário de versão anterior) |
| Sem preferência e sem sinais de uso (instalação nova)            | Registra a versão atual sem abrir          |
| Armazenamento local indisponível ou preferência de versão futura | Não abre automaticamente                   |

Os sinais de uso (`hasPersonalHistory`) são só leitura: nada é migrado ou
regravado. Cotações gravadas automaticamente não contam.

A abertura espera 800 ms e é **adiada** enquanto houver: aviso de
armazenamento protegido, conflito ou alteração legada; conquista sendo
anunciada; treino em andamento aberto em Treinos; diálogo modal ou janela
(`dialog[open]`, `role="dialog"`, ex.: formulário rápido, comando por voz,
confirmação ou restauração de backup); lista suspensa aberta; gravação em
andamento (`aria-busy`); campo em edição; ou aba oculta. A verificação se
repete a cada 1,5 s, sem bloquear o uso do aplicativo.

## Fechamento e preferência

- Fecha pelo ×, por “Começar a usar” (foco inicial) ou por Escape. Não exige
  leitura, rolagem ou interação com os cartões; cabeçalho e rodapé ficam fixos.
- A versão só é registrada **ao fechar** (ou, na instalação nova, sem abrir).
  Exibir não registra nada.
- `life-rpg:whats-new` guarda `{ version: 1, data: { seen: "AAAA-MM-DD" } }` e
  nada mais. Fica fora do `PlayerState`, das migrações e do backup; valor
  inválido é substituído, e a gravação nunca regride para uma versão anterior.

## Consultar pelo Perfil

A seção “Novidades da versão” do Perfil tem o botão secundário “Ver
novidades”, que abre a mesma janela com a entrada mais recente. Fechá-la não
altera registros nem regride a preferência.

## Testes e auditoria

- `releases.test.tsx`, `WhatsNewDialog.test.tsx`, `useWhatsNew.test.tsx`,
  `WhatsNewEntry.test.tsx` e `app/WhatsNew.test.tsx` (fluxo completo no App).
- O setup dos testes e as auditorias de navegador semeiam `seen: "9999-12-31"`
  para a janela automática não cobrir outras telas. `audit:visual` audita a
  janela aberta pelo Perfil em cinco larguras (dentro da tela, × e botão
  inferior alcançáveis, fechamento pelo ×).
