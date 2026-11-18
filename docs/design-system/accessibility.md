# Acessibilidade

Reutilize os comportamentos de
[CustomSelect](../../apps/web/src/shared/components/CustomSelect.tsx),
[CustomDatePicker](../../apps/web/src/shared/components/CustomDatePicker.tsx),
[RecordUI](../../apps/web/src/modules/records/RecordUI.tsx) e
[App](../../apps/web/src/app/App.tsx).

- Use botões para ações, rótulos para campos e uma hierarquia coerente de títulos.
  Em formulários, declare `type`; `ActionButton` já evita submit implícito.
- Preserve o link “Pular para o conteúdo”, o `main` e o foco no título ao navegar.
- O mínimo recorrente de altura é 44 px. Há controles compactos legados de séries
  e navegação; não amplie essa exceção a novos controles sem revisão de toque.
- Não remova outline sem foco equivalente. O tema possui `:focus-visible`
  global; seletores, calendário e treino têm tratamentos próprios.
- Use `Field` ou associação explícita `htmlFor/id`; placeholders não são rótulos.
  Botões só com ícone precisam de `aria-label`. `Icon` é decorativo.
- Use `role="alert"` para erros e `role="status"` / `aria-live="polite"` para
  feedback. Associe erro ao campo com `aria-describedby` quando pertinente.
- Mantenha `disabled` funcional; opacidade sozinha não impede ações.
- Não use apenas cor para distinguir concluído, selecionado, erro ou lucro.
  Mantenha texto, símbolos ou estados ARIA equivalentes.
- Seletores: setas/Home/End, busca por letras, Enter/Espaço, Escape e Tab;
  preserve `combobox`, `listbox`, `option` e retorno de foco.
- Diálogos: título acessível, Escape, foco interno e restauração ao fechar.
- Abas de treino: setas, Home/End, `aria-selected`, `aria-controls` e roving tabIndex.
- Gráficos interativos devem expor valores por teclado/toque e nomes acessíveis.
- Preserve as regras `prefers-reduced-motion: reduce`; novas animações precisam
  oferecer comportamento equivalente sem movimento.

Testing Library verifica roles, rótulos, teclado e foco nos controles existentes.
O projeto não tem auditoria automática completa de contraste ou conformidade
WCAG. Contraste, leitor de tela, zoom, toque e foco no navegador exigem revisão
manual; não declare conformidade apenas porque os testes passaram.
