# Quests personalizadas

Página `/quests`, item **Quests** na navegação e resumo de até cinco quests em andamento no
dashboard (**Minhas Quests**). Nenhuma quest é obrigatória ou atribuída automaticamente. **Criar minha
quest** abre um formulário livre; **Quests sugeridas** apenas preenche um rascunho
que pode ser completamente modificado, e só é gravado após confirmar a criação.
Os exemplos incluem todos os pilares e Geral. Modelos semanais começam na segunda
atual e mensais no primeiro dia do mês para aproveitar registros reais do período;
o usuário pode alterar essas datas ou qualquer outro campo.

O resumo aparece apenas quando há quests em andamento: excluídas, pausadas,
concluídas e ainda não iniciadas ficam fora. Pendências vencidas continuam
acionáveis e aparecem primeiro; os demais objetivos são ordenados pelo prazo
ou fim do ciclo, com objetivos sem prazo ao final. Até cinco são mostrados, com
categoria, valor/percentual, barra na cor do pilar e prazo quando existir.
Sem objetivos disponíveis não há cartão nem espaço reservado; conquistas ocupam
a largura disponível. **Ver todas** abre `/quests` e cada link de quest abre
`/quests?quest=<id>`, preservado na recarga e em Voltar/Avançar. Os detalhes usam o
mesmo `GoalCard`, inclusive conclusão manual e edição. O dashboard não duplica a
seção e não contém modelos ou missões fixas.

## Consulta e organização da página

**Minhas Quests** contém somente objetivos confirmados pelo usuário. Os filtros
por pilar e status são chips com `aria-pressed`, agrupados e rotulados. Status:
Todas, Ativas, Concluídas, Pausadas e Vencidas. Quests futuras continuam em Todas;
uma pausa aberta prevalece na classificação visual, inclusive em ciclos concluídos.
A busca **Buscar quest...** considera título e descrição, ignorando acentos e
maiúsculas/minúsculas, e combina com ambos os filtros. Limpar a busca devolve o
foco ao campo. A contagem de resultados é anunciada sem deslocar o foco.

A ordenação usa um dropdown/listbox customizado e acessível: prazo mais
próximo (padrão, usando o fim do ciclo quando recorrente e sem prazo), maior/menor
progresso, mais recentes e alfabeto pt-BR. Quests sem prazo ficam ao final na
ordenação por prazo; valores desconhecidos ficam ao final nas duas ordenações
por progresso. A criação possui precisão de dia: dentro da mesma data, mais
recentes usa a ordem de cadastro. Desempates nos demais critérios são estáveis.
O mesmo `shared/components/CustomSelect` é usado em todos os campos de seleção
na criação/edição (pilar, tipo, modo, indicador, unidade, frequência e dificuldade)
e na conclusão manual. Não há `<select>` nativo em Quests. Setas, Home/End e letras
navegam; Enter/Espaço confirmam, Escape cancela e Tab segue para o próximo campo.
Clique fora fecha sem perder a escolha anterior. Ícones/cor identificam o pilar,
e a lista não é recortada pelo cartão e se ajusta ao viewport em telas pequenas.
O estado visual é local e a integração com `FormData` conserva os valores internos.

Filtros, busca e ordenação são estado de interface e não modificam o armazenamento,
progresso, XP ou Radar. **Quests sugeridas** fica abaixo da coleção e recolhida por
padrão, com modelos separados por pilar. Sem quests há uma única ação **Criar minha
quest** no estado vazio; sem resultados é possível limpar filtros e busca.
**Ver quests excluídas** mantém o arquivo acessível fora dos cinco chips principais.

Cartões mostram categoria, status, progresso/percentual, prazo, frequência, modo e
XP em blocos menores. A barra e ícone seguem a cor do pilar; Geral é cinza neutro.
Ações de editar/excluir usam ícones rotulados; pausa/retomada e atualização manual
continuam disponíveis. Os detalhes de ciclos, pausas, versões e limitações de XP e
avaliação financeira permanecem em **Histórico de ciclos e atualizações**.
O layout adapta controles/cartões ao espaço disponível e respeita movimento reduzido.

## Modelos e acompanhamento

`GoalDefinition` define título, descrição, pilar, tipo quantitativo/conclusão,
alvo/unidade, início/prazo, frequência, acompanhamento, indicador e dificuldade.
Unidades manuais incluem dias, vezes, páginas, horas, reais, percentual e texto
livre. As quests quantitativas concluem ao atingir ou superar o alvo; limites
máximos de gastos podem ser acompanhados manualmente com uma quest de conclusão.
Quests de conclusão simples são manuais. Não há uma lista fixa de objetivos.

Valores manuais e alvos usam inteiros em milésimos da unidade (até três casas).
Reais usam a máscara monetária existente e precisão de centavos. Não se modifica
a unidade nem a precisão dos registros dos pilares. O progresso numérico é um
**total do ciclo**, não um incremento: 3 de 10 significa informar 3. Há uma
atualização por quest/data/configuração de medida; salvar novamente substitui o valor daquele dia. Uma
atualização posterior pode desfazer uma conclusão. É possível corrigir datas
anteriores dentro do início/prazo da quest ou excluir atualizações do histórico.

Automáticas são projeções somente de leitura dos dados reais:

| Indicador           | Fonte e unidade                                                       |
| ------------------- | --------------------------------------------------------------------- |
| Dias treinados      | Dias únicos marcados Sim; dias                                        |
| Páginas lidas       | Leituras no período; páginas                                          |
| Sono                | Soma de horas no período; horas (use diária para uma quest por noite) |
| Aportes             | Operações reais de contribuição, excluindo posições iniciais; reais   |
| Receitas / despesas | Movimentações do tipo explicitamente escolhido; reais                 |
| Resultado           | Receitas menos despesas do período, sem aportes; reais                |
| Dinheiro disponível | Projeção das contas, sem somar investimentos; reais                   |
| Patrimônio          | Disponível mais avaliação dos investimentos; reais                    |
| Investimentos       | Valor conhecido/estimado da carteira; reais                           |

Quests automáticas exigem pilar e unidade compatíveis com o indicador; Geral e
unidades livres usam acompanhamento manual. Trocar acompanhamento mantém os logs
anteriores, mas não mistura valores manuais com fontes automáticas. Saldo,
patrimônio e investimentos são posições, não somas nem receitas. Usam as últimas
informações realmente conhecidas na data: não há cotações retroativas. Se os dados
necessários faltarem, mostram **Dados pendentes**. Avaliações pelo custo e cotações
desatualizadas mantêm as limitações já identificadas em Finanças.

## Ciclos, pausa, edição e histórico

Frequências: única/até o prazo, diária, semanal (segunda–domingo), mensal de
calendário e personalizada a cada N dias (1–3.650) a partir do início. O início e
o prazo podem cortar o primeiro/último ciclo; não se altera o alvo proporcionalmente.
Os valores manuais guardam a unidade e a configuração de medida. Mudar tipo, unidade, início ou frequência não converte horas em páginas nem totais diários em semanais: exige novos totais para a nova configuração. Os anteriores ficam no histórico e nos ciclos das configurações anteriores.

O histórico mantém os ciclos anteriores e inicia um novo progresso para cada
período. Datas são civis locais. Prazos vencidos ficam identificados sem apagar dados.

Pausar bloqueia novas atualizações manuais. Como os registros dos pilares têm
precisão de data, a pausa automática vale **a partir do fim do dia informado**;
retomar inclui o dia da retomada. Dados até o dia da pausa continuam presentes;
dias inteiros entre pausa e retomada não entram nas somas de atividade. No caso
de saldos, retomar utiliza a posição real, sem subtrair movimentos bancários que
realmente ocorreram. Pausa não cria ciclos premiados ou logs de atividade.

Editar preserva ID, criação, atualizações e pausas, e guarda a definição anterior
em `revisions`. As projeções de ciclos e recompensas usam a definição atual e são
recalculadas, inclusive para correções de alvo/período. Histórico de configurações
e valores manuais permanece consultável. Nenhum registro de outro pilar é apagado.
Excluir exige confirmação: a quest vira um registro com `deletedOn`, sai da lista
ativa e perde suas recompensas. Seu histórico permanece em **Ver quests excluídas**.
Não há alteração nas contas, livros, leituras, treinos, sono, perfil ou missões.

## XP e proteção contra duplicação

A dificuldade é escolhida pelo usuário: leve até **10 XP**, moderada até **25 XP**
e alta até **50 XP**, por conclusão elegível de ciclo. O valor não aumenta com o
patrimônio nem com o dinheiro envolvido. A dificuldade é uma declaração, não uma
medição automática de esforço. Aplicam-se simultaneamente:

- No máximo **50 XP de quests por dia** e **100 XP de quests por semana**, para o
  conjunto de quests. Semana de segunda a domingo.
- Para quests dos quatro pilares, usa-se apenas a parcela disponível do teto diário
  existente da área, já consumido por registros e missões (80/150/120/100 XP).
  Assim, treinar e atingir uma quest automática de treino no mesmo dia não dão
  dois prêmios. É normal uma quest concluída mostrar 0 XP adicional.
- Quests de saldo, patrimônio e valor dos investimentos não dão XP: possuir ou
  valorizar ativos não comprova uma atividade nova. O acompanhamento segue normal.
- Conclusões com data anterior à criação da quest não são premiadas retroativamente.
- Título normalizado, pilar, frequência e ciclo identificam quests repetidas.
  Cópias ativas do mesmo objetivo não multiplicam prêmios. Para quests únicas,
  a mesma identidade não recebe prêmios separados em dias distintos.
- A distribuição é determinística: por data, maior recompensa e ID. Recompensas
  são uma projeção, nunca depósitos acumulados no armazenamento.

Excluir uma quest ou desfazer seu progresso remove o XP atribuído a ela. Uma cópia
criada novamente não acumula o prêmio da quest excluída. Editar quests, registros ou
missões redistribui os limites e recalcula o total, sem duplicação. Quests manuais
são declarações do usuário, como as missões; não há verificação externa do conteúdo
do título. Os limites agregados também se aplicam a objetivos diferentes/renomeados.

Geral pode dar XP dentro desses limites, mas **nenhuma quest altera diretamente o
Radar ou atributos**. O Radar continua usando esforço/consistência dos registros
e missões dos quatro pilares. Atividades de uma quest automática já aparecem ali
por sua fonte real. Quests criadas/editadas não produzem esforço artificial.
O gráfico semanal de XP inclui os prêmios efetivos das quests e o nível continua
`1 + floor(XP_total / 2000)`, com excedente na barra, sem alterar a fórmula.

## Arquitetura e persistência

- `types.ts`: contratos, indicadores compatíveis, dificuldades e estado.
- `commands.ts`: validação e comandos puros, com escrita atômica no estado.
- `cycles.ts`: calendário e pausas; `progress.ts`: fontes/progresso por período.
- `rewards.ts`: projeção/deduplicação e orçamento de XP.
- `dashboardGoals.ts`: seleção e ordenação das pendências do dashboard.
- `templates.ts`: rascunhos opcionais; `format.ts`: apresentação de unidades.
- `GoalsPage.tsx`, `GoalForm.tsx`, `GoalCard.tsx`, `GoalsSummary.tsx`: interface.
- `QuestFilters.tsx`: busca, chips e ordenação customizada; `questList.ts`: seleção de apresentação.
- `goals.test.ts` e `GoalsPage.test.tsx`: cálculos, comandos, migração e fluxos.
- `questList.test.ts` e `QuestBrowse.test.tsx`: consulta combinada, ordenação,
  estados vazios, arquivo, controles acessíveis e preservação do armazenamento.
- `QuestSelect.test.tsx`: dropdowns dos formulários, envio de valores, filtros e
  conclusão/desfazer; contrato compartilhado em `shared/components/README.md`.

O estado `PlayerState.goals` contém quests e atualizações em **versão 4**, na mesma
chave `life-rpg:player-state`. V3 recebe apenas `goals` vazio: perfil, progressão
real, eventos históricos de missões, preferências e todos os registros são copiados intactos.
V1/v2 passam pela correção de progressão real e recebem quests vazias. A migração
ocorre uma vez, sem recreditar recompensas. Falhas de escrita preservam o envelope
anterior; versões desconhecidas não são sobrescritas. Não há backend ou dependências
novas. Limites de armazenamento validados: 200 quests incluindo excluídas, 10.000
atualizações e 1.000 revisões/pausas por quest; início até 100 anos no passado.

Também foram alterados `app/{App,Navigation,views,useUrlNavigation,playerState}`,
estilos compartilhados e testes de persistência/migração para o envelope atual.
A remoção da interface de missões não altera o esquema v4 nem regrava dados na montagem.
`missionEvents` permanece somente leitura para preservar XP, conquistas e Radar
legítimos, compartilhando limites com registros/quests; nenhuma ação cria novos
eventos de missão. `/missoes` e `/metas` redirecionam para `/quests`.
O parâmetro antigo `?meta=<id>` também é aceito e preserva os detalhes.
A nomenclatura pública é Quests; nomes internos e `PlayerState.goals` continuam
iguais, sem migração ou alteração de títulos, histórico e XP já cadastrados.
A página usa controles nativos rotulados, barras acessíveis, diálogo de confirmação
com foco em Cancelar, cartões responsivos e a preferência de movimento reduzido
já aplicada às barras. A navegação móvel acomoda o novo item sem ocultá-lo.

## Verificação no navegador

1. Execute `nvm use` e `npm run dev:web`. Recarregue e abra **Quests** (`/quests`).
2. Clique **Criar minha quest**, dê um título livre e escolha Geral/conclusão
   simples. Confirme, clique **Concluir quest** e salve. Confira XP, conclusão e
   recarga. Desfaça: o XP da quest deve sair sem alterar os pilares.
3. Abra **Quests sugeridas** e escolha um modelo. Altere título, alvo, frequência,
   unidade ou acompanhamento. Confira que nada é criado antes da confirmação.
4. Experimente Treinos automático semanal ou Conhecimento mensal com registros
   reais. Corrija/exclua um registro do pilar e confira o progresso recalculado.
5. Para uma quest manual quantitativa, informe 3 de 10. Salve de novo na mesma data:
   continua uma atualização, sem somar 3 novamente. Altere para 10 e depois 0.
6. Teste os dropdowns de criação/edição e ordenação por clique, setas, Home/End,
   Enter/Espaço, Escape, Tab e clique fora, inclusive em 320 px de largura.
   Combine os chips com busca por título/descrição, limpe a busca e teste as cinco
   ordenações. Pause/retome, consulte ciclos e exclua com confirmação.
   O atalho Ver quests excluídas deve preservar o histórico sem prêmios ativos.
7. Em Finanças, escolha explicitamente aportes, saldo ou patrimônio. Uma posição
   inicial não conta como aporte; oscilação de BTC não produz XP nem dinheiro novo.
8. No dashboard, confira **Minhas Quests**, até cinco por prazo. Abra os detalhes,
   conclua uma manual e volte: a concluída deve sair do resumo. Pause/conclua todas:
   o painel inteiro desaparece e conquistas ocupam o espaço. Confira larguras de
   320, 768 e 1440 px, títulos longos, foco de teclado e movimento reduzido.
9. Reabra `/missoes`: deve chegar a `/quests`, sem missões ou prêmios novos.
10. Consulte Estatísticas para o XP semanal e o Radar, que permanece baseado
    somente nas fontes reais dos quatro pilares.

Testes cobrem criação livre/modelos, modos manual/automático, todos os indicadores,
calendário/recorrência, pausas, edição/exclusão, conclusão/desfazer, limites XP,
anti-duplicação, preservação do Radar, migração v3/v4 e persistência após recarga.
