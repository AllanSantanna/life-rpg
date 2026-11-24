import { useState } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ProgressBar } from '../../../shared/components/ProgressBar';
import { plural } from '../../../shared/lib/plural';
import { AchievementCard } from './AchievementCard';
import { AchievementMedal } from './AchievementMedal';
import {
  achievementGroups,
  achievementRarities,
  rarityLabels,
} from './catalog';
import {
  achievementTotals,
  featuredAchievements,
  type AchievementStatus,
} from './evaluate';
import { useAchievementsView } from './viewPreferences';
import { defaultAchievementFilters, filterAchievements } from './filters';
import { unlockedOnLabel } from './format';

const ACHIEVEMENTS_SECTION_ID = 'conquistas';

/**
 * Seção Conquistas do Perfil (âncora `#conquistas`): progresso geral, medalhas
 * em destaque escolhidas automaticamente e galeria completa com filtros.
 * Conquistas bloqueadas continuam visíveis; o catálogo não tem secretas.
 */
export function AchievementsSection({
  achievements,
  highlighted = false,
}: {
  achievements: readonly AchievementStatus[];
  /** Aberta pelo atalho "Ver conquistas": destaque breve na chegada. */
  highlighted?: boolean;
}) {
  const [filters, setFilters] = useState(defaultAchievementFilters);
  const [view, setView] = useAchievementsView();
  const totals = achievementTotals(achievements);
  const featured = featuredAchievements(achievements, 4);
  const visible = filterAchievements(achievements, filters);
  const byRarity = achievementRarities.map((rarity) => {
    const items = achievements.filter((status) => status.rarity === rarity);
    return {
      rarity,
      total: items.length,
      unlocked: items.filter((status) => status.unlocked).length,
    };
  });
  const filtered =
    filters.group !== 'all' ||
    filters.rarity !== 'all' ||
    filters.state !== 'all';
  return (
    <section
      id={ACHIEVEMENTS_SECTION_ID}
      tabIndex={-1}
      aria-labelledby="achievements-title"
      className={`panel achievements-section${highlighted ? ' is-highlighted' : ''}`}
    >
      <header className="achievements-section__header">
        <div>
          <p className="eyebrow">Perfil do jogador</p>
          <h2 id="achievements-title">Conquistas</h2>
          <p className="achievements-section__intro">
            Calculadas a partir dos seus registros reais. Editar ou excluir um
            registro atualiza o progresso; não há bônus de XP.
          </p>
        </div>
      </header>

      <div className="achievements-overview">
        <dl className="achievements-overview__totals">
          <div>
            <dt>Total</dt>
            <dd>{totals.total}</dd>
          </div>
          <div>
            <dt>Desbloqueadas</dt>
            <dd>{totals.unlocked}</dd>
          </div>
          <div>
            <dt>Bloqueadas</dt>
            <dd>{totals.locked}</dd>
          </div>
          <div>
            <dt>Conclusão</dt>
            <dd>{totals.percent}%</dd>
          </div>
        </dl>
        <ProgressBar
          label="Conclusão das conquistas"
          value={totals.unlocked}
          max={totals.total}
        />
        <ul
          className="achievements-overview__rarities"
          aria-label="Conquistas por raridade"
        >
          {byRarity.map((item) => (
            <li key={item.rarity} data-rarity={item.rarity}>
              <span className="achievement-rarity" data-rarity={item.rarity}>
                {rarityLabels[item.rarity]}
              </span>
              <span>
                {item.unlocked}/{item.total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <section
        aria-labelledby="achievements-featured-title"
        className="achievements-featured"
      >
        <h3 id="achievements-featured-title">Medalhas em destaque</h3>
        {featured.length ? (
          <ul className="achievements-featured__list">
            {featured.map((status) => (
              <li key={status.id} data-rarity={status.rarity}>
                <AchievementMedal status={status} size="lg" animated />
                <p className="achievements-featured__title">{status.title}</p>
                <p>
                  <span
                    className="achievement-rarity"
                    data-rarity={status.rarity}
                  >
                    {rarityLabels[status.rarity]}
                  </span>
                </p>
                <p className="achievements-featured__date">
                  {unlockedOnLabel(status)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="achievements-section__empty">
            Suas medalhas mais raras aparecerão aqui assim que forem
            desbloqueadas.
          </p>
        )}
      </section>

      <section
        aria-labelledby="achievements-gallery-title"
        className="achievements-gallery"
      >
        <h3 id="achievements-gallery-title">Galeria de conquistas</h3>
        <label className="strength-switch achievements-featured-only">
          <span>
            <strong>Ocultar galeria</strong>
            <small>Mostra apenas as medalhas em destaque</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Ocultar galeria de conquistas"
            checked={view.featuredOnly}
            onChange={(event) =>
              setView({ featuredOnly: event.target.checked })
            }
          />
          <span aria-hidden="true" className="strength-switch-track" />
        </label>
        {view.featuredOnly ? (
          <p className="achievements-section__empty">
            {`Galeria oculta. Desative "Ocultar galeria" para ver as ${totals.total} conquistas, inclusive as bloqueadas.`}
          </p>
        ) : (
          <>
            <div
              className="achievements-filters"
              role="group"
              aria-label="Filtrar conquistas"
            >
              <CustomSelect
                label="Pilar"
                compact
                value={filters.group}
                options={[
                  { value: 'all', label: 'Todos os pilares' },
                  ...achievementGroups.map((group) => ({
                    value: group,
                    label: group,
                  })),
                ]}
                onChange={(group) => setFilters({ ...filters, group })}
              />
              <CustomSelect
                label="Raridade"
                compact
                value={filters.rarity}
                options={[
                  { value: 'all', label: 'Todas as raridades' },
                  ...achievementRarities.map((rarity) => ({
                    value: rarity,
                    label: rarityLabels[rarity],
                  })),
                ]}
                onChange={(rarity) => setFilters({ ...filters, rarity })}
              />
              <CustomSelect
                label="Estado"
                compact
                value={filters.state}
                options={[
                  { value: 'all', label: 'Todos os estados' },
                  { value: 'unlocked', label: 'Desbloqueadas' },
                  { value: 'locked', label: 'Bloqueadas' },
                ]}
                onChange={(state) => setFilters({ ...filters, state })}
              />
            </div>
            <div className="achievements-gallery__status">
              <p aria-live="polite">
                {`Mostrando ${plural(visible.length, 'conquista', 'conquistas')} de ${totals.total}`}
              </p>
              {filtered && (
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setFilters(defaultAchievementFilters)}
                >
                  Limpar filtros
                </button>
              )}
            </div>
            {visible.length ? (
              <ul className="achievements-gallery__grid">
                {visible.map((status) => (
                  <li key={status.id}>
                    <AchievementCard status={status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="achievements-section__empty">
                Nenhuma conquista corresponde aos filtros escolhidos.
              </p>
            )}
          </>
        )}
      </section>
    </section>
  );
}
