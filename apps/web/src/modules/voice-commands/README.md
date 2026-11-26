# Comando por voz

Registra atividades dos quatro pilares por uma frase falada ou digitada. Não usa
IA generativa, modelos locais, serviços pagos nem backend: a fala vira texto
pela Web Speech API do navegador e o texto é interpretado por regras em
TypeScript. **Nada é gravado sem confirmação explícita.**

## Arquitetura

| Arquivo                  | Responsabilidade                                                           |
| ------------------------ | -------------------------------------------------------------------------- |
| `recognition.ts`         | Fala → texto (`SpeechRecognition` / `webkitSpeechRecognition`)             |
| `text.ts`, `patterns.ts` | Normalização, números por extenso, valores, horas, páginas e datas         |
| `parser.ts`              | Frase → rascunho tipado (`ParseResult`), com faltas, ambiguidades e erros  |
| `commands.ts`            | Contexto de leitura dos registros e conversão para o `RecordCommand` atual |
| `VoiceCommandButton.tsx` | Botão, estados da escuta e confirmação (`useConfirmedCommand`)             |
| `VoiceCommandDialog.tsx` | Janela modal: escuta, frase reconhecida, cartão de confirmação e edição    |

O parser é puro: não acessa IndexedDB, não altera estado e não completa dados
ausentes. A confirmação usa os comandos existentes (`saveMovement`,
`saveSleep`, `saveReading`, `saveWorkout`) pelo mesmo `onCommand` do App, com as
mesmas validações, persistência, XP e Radar. O sucesso só aparece depois de
`whenSaved()` confirmar a gravação; em falha, os dados ficam na tela, o comando
não é reaplicado e “Tentar novamente” verifica a gravação outra vez.

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

| Pilar        | Exemplos reconhecidos                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Despesa      | “Gastei dez reais com chocolate”, “Comprei um chocolate por dez reais”, “Paguei cinquenta reais de internet”         |
| Receita      | “Recebi duzentos reais”, “Recebi três mil reais de salário”, “Entraram cem reais de um serviço”                      |
| Descanso     | “Dormi sete horas e meia”, “Ontem dormi seis horas e trinta minutos”, “Registra sete horas e quinze minutos de sono” |
| Conhecimento | “Li vinte páginas de Meditações”, “Registra dez páginas no livro Meditações”, “Hoje li quinze páginas”               |
| Treinos      | “Treinei hoje”, “Fiz musculação hoje”, “Hoje eu treinei”, “Treinei ontem”, “malhei dia 10”                           |

## Regras de interpretação

- **Prioridade:** valor em dinheiro ou verbo financeiro (gastei, comprei,
  paguei, recebi, entrou, vendi) → Finanças. “Comprei um livro por cinquenta
  reais” é despesa; leitura exige verbo de leitura (li, leitura) ou páginas.
  “Paguei a academia” é despesa, não treino. Duas ações na mesma frase
  (“dormi sete horas e li vinte páginas”) pedem uma por vez.
- **“Ganhei”** só é receita com contexto de dinheiro (valor, reais, salário,
  pix…); “ganhei um livro” não é entendido como receita.
- **Mais de um valor diferente** pede esclarecimento. “Três chocolates por dez
  reais” fica R$ 10,00 (não multiplica); só “por dez reais **cada**” mostra
  “3 × R$ 10,00” para confirmação.
- **Categoria:** inferida por palavras-chave apenas quando corresponde a uma
  categoria já existente no histórico (ex.: chocolate, mercado → Alimentação).
  Caso contrário, o cartão pede a escolha. Nenhuma categoria é criada.
- **Livro:** título exato ou parcial, sem acentos. Um único livro em andamento
  é escolhido quando nenhum título é dito; título ambíguo ou ausente com vários
  livros pede a escolha; sem livros, orienta o cadastro.
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
