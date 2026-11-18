import type { KeyboardEvent, Ref } from 'react';
import { Icon } from '../../shared/components/Icon';
import { areas } from '../evolution/scoring';
import type { Pillar } from './types';
import {
  defaultStatisticsView,
  type StatisticsSection,
  type StatisticsView,
} from './viewPreferences';

const sections: { id: StatisticsSection; label: string; hint: string }[] = [
  {
    id: 'radar',
    label: 'Radar de Evolução',
    hint: 'Componente original, com o próprio filtro',
  },
  {
    id: 'landscape',
    label: 'Paisagem da Evolução 3D',
    hint: 'Quando desativada, o recurso 3D não é baixado',
  },
  {
    id: 'calendar',
    label: 'Calendário de Atividades',
    hint: 'Intensidade diária e detalhes do dia',
  },
];

function Switch({
  area,
  label,
  hint,
  checked,
  onChange,
}: {
  area?: Pillar;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="strength-switch statistics-switch" data-area={area}>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" className="strength-switch-track" />
    </label>
  );
}

/** Botão discreto do cabeçalho; o painel é renderizado em largura total. */
export function CustomizeTrigger({
  open,
  controls,
  onToggle,
  ref,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`filter-button statistics-customize-trigger ${open ? 'active' : ''}`}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
    >
      <Icon name="layers" size={16} />
      Personalizar visualização
    </button>
  );
}

/** Mostra ou oculta seções; nunca altera registros ou cálculos. */
export function CustomizePanel({
  id,
  view,
  onChange,
  onClose,
}: {
  id: string;
  view: StatisticsView;
  onChange: (view: StatisticsView) => void;
  onClose: () => void;
}) {
  const allVisible =
    sections.every((section) => view[section.id]) &&
    areas.every((area) => view.cards[area]);
  function escape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  }
  function setCard(area: Pillar, checked: boolean) {
    onChange({ ...view, cards: { ...view.cards, [area]: checked } });
  }
  return (
    <section
      id={id}
      className="panel statistics-customize-panel"
      aria-label="Personalizar visualização"
      onKeyDown={escape}
    >
      <p className="statistics-copy">
        Escolha o que aparece nesta página. Ocultar uma seção não exclui dados
        nem altera pontuações; as escolhas ficam salvas neste navegador.
      </p>
      <fieldset>
        <legend className="eyebrow">Seções</legend>
        {sections.map((section) => (
          <Switch
            key={section.id}
            label={section.label}
            hint={section.hint}
            checked={view[section.id]}
            onChange={(checked) => onChange({ ...view, [section.id]: checked })}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend className="eyebrow">Cartões dos pilares</legend>
        {areas.map((area) => (
          <Switch
            key={area}
            area={area}
            label={`Cartão de ${area}`}
            hint="Indicadores do período selecionado"
            checked={view.cards[area]}
            onChange={(checked) => setCard(area, checked)}
          />
        ))}
      </fieldset>
      <div className="statistics-customize-actions">
        <button
          type="button"
          className="filter-button"
          disabled={allVisible}
          onClick={() => onChange(defaultStatisticsView())}
        >
          Mostrar todas as seções
        </button>
        <button type="button" className="filter-button" onClick={onClose}>
          Concluir
        </button>
      </div>
    </section>
  );
}
