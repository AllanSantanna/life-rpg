Componentes visuais reutilizáveis sem regras de domínio.

## CustomSelect

`CustomSelect.tsx` é o seletor compartilhado do aplicativo, sem dependências adicionais.
Aceita modo controlado (`value`/`onChange`) ou não controlado (`defaultValue`);
`label` e `options` definem a apresentação. Opções podem ter ícone, cor de área e
estado desabilitado. `compact` é usado na ordenação; `name` inclui um input oculto
com o valor real para `FormData`. Não há `<select>` nativo nem escrita em storage.
O botão continua rotulado dentro de `Field` e mostra o texto da opção escolhida.
No modo não controlado, alterações de `defaultValue` não sobrescrevem a escolha;
opções removidas usam a primeira disponível, sem disparar `onChange`. Seleções
vazias/desabilitadas não enviam um valor inválido em `FormData`. Os formulários
reiniciam as escolhas pelos mesmos IDs/revisões que já utilizavam.

Combobox de seleção única com `aria-expanded`, `aria-controls`,
`aria-activedescendant`, listbox/option, `aria-selected` e `aria-disabled`.
O foco fica no botão; setas, Home e End movem a opção ativa sem alterar o valor.
Enter/Espaço confirmam, Escape cancela e restaura foco, Tab fecha e segue a ordem
normal. Letras buscam pelo início do rótulo, ignorando acentos. Itens desabilitados
são ignorados na navegação e não podem ser escolhidos. Clique no controle alterna
a lista; clique fora e foco fora fecham sem roubar foco do destino.

A lista usa portal no `document.body`, posicionamento fixo e limites do viewport,
inclusive `visualViewport`, para evitar recortes por formulários/cartões. Recalcula
posição em scroll/resize, abre acima se necessário e tem rolagem interna e opções
com alvo de 44 px. A saída animada fica inerte e oculta da árvore de acessibilidade;
timers e listeners são limpos ao desmontar. Movimento reduzido desativa as animações.

`CustomSelect.test.tsx` cobre interação, teclado, foco, formulários, opções
desabilitadas, movimento reduzido e posicionamento em viewport móvel/redimensionado.
Os testes de Quests verificam integração com edição, filtros, recarga e conclusão.

## CustomDatePicker

`CustomDatePicker.tsx` fornece os calendários dos formulários de Quests, mantendo
os valores ISO `AAAA-MM-DD` / `AAAA-MM` em `FormData` e nos callbacks. Aceita
`value`/`onChange` ou `defaultValue`, `name`, `min`, `max`, `required`, `readOnly` e
`disabled`. Na tela, datas são DD/MM/AAAA e meses MM/AAAA. Campos opcionais podem
ser limpos; abrir/navegar no calendário não cria uma data nem grava registros.

O controle abre um diálogo com grade de dias, escolha de mês/ano, navegação e
Hoje/Mês atual. Setas movem o foco, Home/End vão às extremidades da semana/linha,
PageUp/Down mudam mês e Shift+PageUp/Down mudam ano. Enter/Espaço selecionam o dia
focado. Escape e clique fora cancelam; o foco retorna ao controle. Tab/Shift+Tab
percorrem os controles do diálogo. O campo **Digitar data/mês** aceita o formato
local e ISO, com máscara numérica; **Aplicar** confirma sem submeter o formulário.

Datas inexistentes e escolhas fora da faixa são bloqueadas. Uma entrada visualmente
oculta participa da validação do formulário; sua mensagem nativa é suprimida e o
calendário apresenta o erro acessível. Campos somente de leitura conservam a data
e o envio do valor, sem permitir alterá-la. A seleção evita conversões de fuso.

`useAnchoredPopover.ts` compartilha geometria, resize/scroll, fechamento e movimento
reduzido com `CustomSelect`. O calendário usa `dialog.showModal()` com fallback,
portal, foco na grade e fechamento de backdrop; limita largura/altura ao viewport,
inclusive quando o teclado móvel encobre o campo. Ao fechar, o diálogo sai da
camada modal antes de animar, sem prender o foco no conteúdo inerte.

`shared/dates/calendar.ts` disponibiliza as mesmas funções civis usadas em
`modules/records/dates.ts` para os controles compartilhados. `shared/dates/picker.ts`
cuida de máscara, leitura, limites e navegação sem alterar regras financeiras,
XP ou Radar. Os testes de calendário cobrem datas bissextas, viradas de mês/ano,
teclado, foco, limites, limpeza, formulários e viewport móvel.
