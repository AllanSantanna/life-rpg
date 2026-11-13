# Quatro pilares — registros locais

Os módulos são acessíveis pelos cartões do dashboard, pela aba **Pilares** e
pelas URLs `/financas`, `/treinos`, `/descanso` e `/conhecimento`.
Os registros continuam locais, sem autenticação. Finanças consulta a cotação
pública BTC/BRL; os demais pilares não dependem dessa integração.

## Registros e cálculos

- **Finanças:** receitas e despesas usam centavos inteiros. Descrição, categoria,
  data e valor são obrigatórios. O mês selecionado filtra totais e histórico.
  Investimentos têm nome, categoria e operações próprias. A aplicação inicial é
  gravada junto ao cadastro, atomicamente. Quantidade × preço determina o custo
  quando os dois são informados. Retiradas não podem deixar saldo aplicado negativo
  em nenhuma data; editar/excluir um aporte também respeita essa validação.
  A carteira distingue custo de aquisição e valor atual manual/estimado. Bitcoin
  usa satoshis, custo médio e cotação pública. Contas têm saldo inicial explícito;
  transferências não alteram o fluxo mensal. Patrimônio = disponível + investimentos.
  Consulte [Finanças](../apps/web/src/modules/finances/README.md) para contas,
  vendas parciais, avaliações, gráficos e compatibilidade com os dados anteriores.
  Aportes/retiradas são transferências da carteira: não criam receitas/despesas de
  consumo nem alteram o saldo operacional mensal (receitas menos despesas).
- **Treinos:** um registro por data, com Sim/Não. Salvar novamente substitui o
  registro; excluir remove. Calendário mensal navegável e clicável, frequência nos
  últimos 7 dias e mês selecionado, total e consistência mensal. Consistência =
  dias treinados / dias decorridos do mês. Ausência de registro difere de Não.
- **Descanso:** um registro de 0–24 horas por data, aceitando vírgula decimal.
  Médias incluem apenas dias registrados; a interface informa a quantidade de
  amostras. Consistência = dias com horas >= meta / dias decorridos do mês. Meta
  pessoal entre 1–24 horas. Alterá-la recalcula consistência e XP das noites salvas,
  sem acumular recompensas. A data fica fixa na edição; para trocar de data,
  remova o registro incorreto e cadastre o dia correto.
- **Conhecimento:** apenas título e páginas totais. Leituras somam páginas de
  sessões; edição substitui uma sessão e exclusão remove sua contribuição. Progresso
  nunca excede o total. Diminuir o total do livro abaixo do já lido é bloqueado.
  Concluir um livro registra as páginas restantes hoje, mantendo a entrada no
  histórico; editar/excluir essa leitura corrige/desfaz a conclusão. Livros finalizados
  ficam na biblioteca. Total, últimos 7 dias, mês atual e livros concluídos são derivados.

Datas são civis no fuso local do navegador; os cálculos de intervalos usam dias
inteiros para não depender de horário de verão. Formulários bloqueiam datas futuras.
O dia atual é atualizado ao abrir, a cada minuto e ao retornar à aba. Semana =
últimos 7 dias incluindo hoje; mês = mês calendário. Nenhum registro real é preenchido
com dados fictícios. Os indicadores absolutos do dashboard usam somente registros reais.

## XP sem duplicação

As fórmulas de nível e os prêmios das missões existentes continuam iguais.
Todo jogador começa no nível 1/0 XP; a origem fictícia anterior é removida pela migração v3. Novos registros têm teto por **área/dia**:

| Área         | XP por dia qualificado | Condição                                             |
| ------------ | ---------------------: | ---------------------------------------------------- |
| Finanças     |                     80 | Ao menos uma movimentação, aporte ou retirada válida |
| Treinos      |                    150 | Dia marcado Sim                                      |
| Descanso     |                    120 | Sono >= meta pessoal atual                           |
| Conhecimento |                    100 | Ao menos uma página registrada                       |

Valores financeiros, páginas adicionais e várias entradas no mesmo dia não
multiplicam XP. Cadastrar um investimento sem operação ou um livro sem leitura
não dá XP. Dia Não e sono abaixo da meta não dão XP de registros.

Missões confirmadas pelo usuário são datadas e compartilham o limite de área/dia
com os registros reais. Nenhuma missão começa concluída. Marcar/desmarcar não
acumula recompensas: a projeção calcula uma única recompensa por área/data
qualificada. As duas missões de Descanso compartilham o teto de 120 XP.

XP total = soma dos prêmios dos dias qualificados reais. O nível permanece
`1 + floor(XP_total / 2000)` e a barra usa `XP_total % 2000`. Editar, excluir,
alternar Sim/Não ou mudar a meta recalcula as fontes. Posições iniciais, cotações,
avaliações e transferências entre contas não geram XP. O gráfico semanal usa
somente ações e missões reais datadas, sem saldo inicial ou demonstração.

## Radar e dados legados

A fórmula existente permanece **70% esforço + 30% frequência**, com escala 0–100,
metas semanais Finanças 3, Treinos 4, Descanso 7 e Conhecimento 5, proporcionais aos
períodos de 7/30/90 dias. Janelas anteriores não se sobrepõem às atuais.

Registros reais fornecem por área/dia: Finanças 1 independentemente de valor;
Treinos 1 para Sim; Descanso `min(horas/meta, 1)`; Conhecimento 1 se houver leitura.
Há no máximo 1 unidade por área/dia. Sono parcial contribui proporcionalmente para
o radar, mas só dá XP quando a meta é atingida. Várias atividades financeiras ou
leituras no mesmo dia não somam pontos extras.

O histórico fictício não participa das projeções e é retirado pela migração v3.
As missões efetivamente marcadas pelo usuário no catálogo antigo são preservadas
quando eram inicialmente pendentes; a missão já concluída por padrão é descartada.
A data fixa antiga 13/11/2026 é conservada para essas conclusões porque o formato
anterior não armazenava a data do clique. Novas confirmações usam a data real.
XP histórico real não expira; dedicação recente diminui conforme o tempo passa.

Atributos Força/Conhecimento/Riqueza usam os escores reais de Treinos/Conhecimento/
Finanças em 7 dias; Disciplina usa a média dos quatro pilares. Conquistas derivam
primeira atividade qualificada, sete dias consecutivos, três livros concluídos e
metas dos quatro pilares em 7 dias. Não há desbloqueios iniciais nem bônus de XP.

## Persistência e migração

Mesma chave `life-rpg:player-state`, versão **3**. V1/v2 válidas são migradas uma
única vez, normalizando a origem de progresso e retirando dados demonstrativos.
O perfil pessoal, preferências e todos os registros reais são preservados. Falhas
de gravação mantêm o original; versões desconhecidas não são sobrescritas.
[Contrato completo de persistência](../apps/web/src/shared/storage/README.md).
As projeções não são salvas como acumuladores ou valores financeiros novos.

## Verificar no navegador

```bash
nvm use
npm run dev:web
```

1. **Finanças:** adicione uma receita e uma despesa, edite/exclua e selecione um
   mês anterior. Cadastre um investimento (por valor ou quantidade/preço), faça
   aportes e retiradas e confira que o saldo de consumo não muda.
2. **Treinos:** marque Sim, depois Sim novamente. Confira que há um único dia.
   Toque em dias anteriores no calendário para corrigir. Teste Não e remover.
3. **Descanso:** registre 7,5 horas, edite a noite, altere a meta e confira as médias.
4. **Conhecimento:** cadastre livros, registre páginas, tente exceder o total,
   conclua um livro e corrija a leitura de conclusão no histórico.
5. Volte ao dashboard e confira XP, indicadores e radar. Abra Estatísticas pelo
   radar e teste os filtros 7/30/90. Um treino e sua missão na mesma data não
   duplicam recompensa. Missões antigas são identificadas pela data legado.
6. Pressione F5 e feche/reabra no mesmo endereço. Registros e rota devem permanecer.
   DevTools → Application → Local Storage mostra `version: 2` na chave do app.

## Arquivos da implementação

Criados em `apps/web/src/`:

- `modules/finances/{types.ts,calculations.ts,FinancesPage.tsx}`.
- `modules/workouts/{types.ts,calculations.ts,WorkoutsPage.tsx}`.
- `modules/rest/{types.ts,calculations.ts,RestPage.tsx}`.
- `modules/knowledge/{types.ts,calculations.ts,KnowledgePage.tsx}`.
- `modules/records/{types.ts,dates.ts,commands.ts,progression.ts,metrics.ts,form.ts,
RecordUI.tsx,useCommand.ts,useToday.ts,PillarLinks.tsx,records.test.ts}`.
- `app/{views.ts,Pillars.test.tsx,migration.test.tsx}`.

Alterados em `apps/web/src/`:

- `app/{App.tsx,Navigation.tsx,useUrlNavigation.ts,playerState.ts,usePlayerState.ts,
Persistence.test.tsx}`.
- `modules/evolution/{EvolutionPanel.tsx,README.md}`.
- `modules/missions/MissionList.tsx`.
- `shared/components/MetricCard.tsx`.
- `shared/storage/{localStateStorage.ts,localStateStorage.test.ts,README.md}`.
- `shared/styles/index.css` e `test/setup.ts`.

Documentação criada/atualizada: `docs/four-pillars.md`, `README.md`,
`docs/architecture.md` e `docs/product.md`.
