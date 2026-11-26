# Comando por voz

Registra atividades dos quatro pilares por uma frase falada ou digitada. Não usa
IA generativa, modelos locais, serviços pagos nem backend: a fala vira texto
pela Web Speech API do navegador e o texto é interpretado por regras em
TypeScript. **Nada é gravado sem confirmação explícita.**

## Arquitetura

| Arquivo                  | Responsabilidade                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `recognition.ts`         | Fala → texto (`SpeechRecognition` / `webkitSpeechRecognition`)                                           |
| `text.ts`, `patterns.ts` | Normalização, números por extenso, valores, horas, páginas e datas                                       |
| `parser.ts`              | Frase → rascunho tipado (`ParseResult`), com faltas, ambiguidades e erros                                |
| `commands.ts`            | Contexto dos registros, validação do rascunho (`validateDraft`) e conversão para o `RecordCommand` atual |
| `VoiceCommandButton.tsx` | Botão, estados da escuta e confirmação (`useConfirmedCommand`)                                           |
| `VoiceCommandDialog.tsx` | Janela modal: escuta, frase reconhecida, cartão de confirmação e edição                                  |

O parser é puro: não acessa IndexedDB, não altera estado e não completa dados
ausentes. A confirmação usa os comandos existentes (`saveMovement`,
`saveSleep`, `saveReading`, `saveWorkout`) pelo mesmo `onCommand` do App, com as
mesmas validações, persistência, XP e Radar. O sucesso só aparece depois de
`whenSaved()` confirmar a gravação; em falha, os dados ficam na tela, o comando
não é reaplicado e “Tentar novamente” verifica a gravação outra vez.

## Cartão de confirmação

- Mostra o pilar e a ação reconhecida (ex.: “Finanças · Registrar despesa”),
  com indicador discreto do tipo: vermelho para despesa, verde para receita,
  amarelo quando o tipo ainda precisa ser escolhido.
- Os campos são editáveis no próprio cartão: tipo de movimentação, descrição,
  valor, categoria, horas, livro, páginas e data. “Editar” abre o formulário
  completo do pilar (ex.: repetição de receitas e despesas).
- O cartão exibe exatamente o rascunho que será gravado: nenhuma opção aparece
  como escolhida sem estar no rascunho. “Geral” é a categoria padrão do
  aplicativo (a mesma do formulário de movimentações) e aparece como opção, não
  como valor escolhido.
- `validateDraft` é a única validação antes de gravar; cada pendência aparece
  junto ao campo (“Escolha a categoria.”) e no resumo “Preciso confirmar
  algumas informações”. O comando existente valida de novo ao gravar.
- **Confirmar sempre responde:** com pendências, anuncia o que falta (alerta
  acessível) e leva o foco ao primeiro campo pendente; completo, grava. Só fica
  desabilitado durante a gravação (“Salvando…”).
- Sono já registrado na data: “Já existe um registro de sono nesta data.
  Deseja substituí-lo?”, e o botão passa a “Substituir registro”.
- Treino já registrado na data: a pendência explica que o dia já está
  registrado; nada é duplicado e nenhum XP é concedido de novo.
- Frase não entendida: opções Despesa, Receita, Sono, Leitura e Treino (o
  cartão abre vazio para preencher), falar de novo, corrigir a frase ou abrir as
  Ações rápidas.

## Reconhecimento de fala

- Idioma `pt-BR`, um comando por vez (`continuous = false`), só resultado final
  (`interimResults = false`), uma alternativa.
- A escuta só começa por toque ou clique; termina com o fim da fala, ao
  cancelar, ao fechar a janela, ao trocar de aba (aba oculta) ou após 12 s sem
  resultado (tempo esgotado). O microfone nunca fica aberto em segundo plano.
- Estados: inativo, solicitando permissão, ouvindo, processando, aguardando
  confirmação (prévia), edição, erro e indisponível.
- Erros tratados: permissão negada, microfone indisponível, nenhuma fala, tempo
  esgotado, falha de rede do serviço, idioma/navegador sem suporte e
  interrupção.
- Sem a API (ex.: Firefox), não há botão “Falar”: a janela oferece a frase
  digitada (inclusive pelo ditado do teclado), interpretada pelo mesmo parser.
- Privacidade: o áudio não é gravado e a frase não é armazenada nem enviada a
  um servidor do Life RPG. Dependendo do navegador, o reconhecimento pode usar
  serviços externos (o Chrome usa os servidores do Google); por isso não se
  promete funcionamento offline.

## Formatos suportados

O interpretador entende somente os formatos abaixo; frases fora deles mostram
“Não consegui identificar a ação.” Acentos e maiúsculas são ignorados.

| Elemento | Formatos                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valores  | “dez reais”, “10 reais”, “R$ 10”, “R$10”, “10,50”, “R$ 1.234,56”, “dez reais e cinquenta (centavos)”, “10 e 50”, “cinquenta centavos”, “três mil reais”; número logo após o verbo (“gastei 10 com…”) |
| Números  | Por extenso até milhares (“vinte e cinco”, “cento e vinte”, “mil e quinhentos”); “dez e cinquenta” não vira 60                                                                                       |
| Horas    | “sete horas”, “sete horas e meia”, “seis horas e trinta minutos”, “7,5 horas”, “7h30”, “7:30”                                                                                                        |
| Páginas  | “vinte páginas”, “20 páginas”, “15 pág”                                                                                                                                                              |
| Datas    | “hoje”, “ontem”, “anteontem”, “12/11”, “12/11/2026”, “dia 12”, “12 de novembro (de 2026)”; ausente = hoje                                                                                            |

| Pilar        | Exemplos reconhecidos                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Despesa      | “Comprei um chocolate de R$ 10”, “Gastei dez conto no chocolate”, “Fiz uma compra de trinta reais”, “Comprei um lanche e paguei doze reais”, “Acabei de gastar quinze reais” |
| Receita      | “Recebi duzentos reais”, “Meu salário caiu, três mil reais”, “Entraram cem reais na minha conta”, “Ganhei R$ 150 trabalhando”                                                |
| Descanso     | “Dormi sete horas e meia”, “Ontem dormi seis horas e trinta minutos”, “Registra sete horas e quinze minutos de sono”                                                         |
| Conhecimento | “Li vinte páginas de Meditações”, “Registra dez páginas no meu livro”, “Li umas vinte páginas”, “Li cinco páginas ontem”                                                     |
| Treinos      | “Treinei hoje”, “Fiz musculação hoje”, “Acabei de treinar”, “Treinei hoje de manhã”, “Treino feito”                                                                          |

## Regras de interpretação

- **Prioridade:** valor em dinheiro ou verbo financeiro (gastei, comprei,
  paguei, recebi, entrou, vendi) → Finanças. “Comprei um livro por cinquenta
  reais” é despesa; leitura exige verbo de leitura (li, leitura) ou páginas.
  “Paguei a academia” é despesa, não treino. Duas ações na mesma frase
  (“dormi sete horas e li vinte páginas”) pedem uma por vez.
- **“Ganhei”, “entrou” e “caiu”** só são receita com contexto de dinheiro
  (valor, reais, salário, pix…); “ganhei um livro” e “caiu a internet” não são.
- **Valor sem verbo** (“dez reais de chocolate”): o tipo não é presumido; o
  cartão pede Despesa ou Receita.
- **Não suportado por voz:** investimentos (ações, aportes, CDB, resgates,
  bitcoin, caixinha) e transferências entre contas próprias; a mensagem orienta
  usar Finanças. “Paguei a academia e treinei” tem duas ações e é recusada.
- **Treino** exige verbo de treino (“treinei”, “acabei de treinar”, “fiz
  musculação”, “treino feito”); “o treino de ontem foi pesado” não registra.
- **Mais de um valor diferente** pede esclarecimento. “Três chocolates por dez
  reais” fica R$ 10,00 (não multiplica); só “por dez reais **cada**” mostra
  “3 × R$ 10,00” para confirmação.
- **Categoria:** inferida por palavras-chave apenas quando corresponde a uma
  categoria já existente no histórico (ex.: chocolate, mercado → Alimentação).
  Caso contrário, o cartão pede a escolha. Nenhuma categoria é criada.
- **Livro:** título exato ou parcial, sem acentos. Um único livro em andamento
  é escolhido quando nenhum título é dito; título ambíguo ou ausente com vários
  livros pede a escolha no cartão (só livros em andamento); livro concluído não
  recebe leitura nova; sem livros, orienta o cadastro.
- **Bloqueios:** data futura, horas fora de 0–24, páginas zero ou acima do
  restante do livro e treino já registrado na data impedem a confirmação.
- **Sono existente:** avisa e confirmar substitui as horas do dia (um registro
  por data, a regra do Descanso). **Sessão avançada concluída** na data: o dia
  é contado uma única vez; nenhuma sessão é criada, alterada ou apagada.

## Limitações conhecidas

- A Web Speech API não existe em todos os navegadores (ex.: Firefox) e, no
  Chrome, depende de conexão com o serviço de fala.
- A precisão da transcrição depende do navegador, do microfone e do ambiente.
- O reconhecimento real só pode ser comprovado em aparelho físico; os testes
  automatizados usam a API simulada.
