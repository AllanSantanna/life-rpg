import { ActionButton } from '../../../shared/components/ActionButton';
import { ProgressBar } from '../../../shared/components/ProgressBar';
import { SectionHeading } from '../../../shared/components/SectionHeading';
import { AchievementMedal } from './AchievementMedal';
import { rarityLabels } from './catalog';
import {
  achievementTotals,
  nearestAchievement,
  recentAchievements,
  type AchievementStatus,
} from './evaluate';

/**
 * Resumo compacto (Início e Estatísticas): totais, até três conquistas
 * recentes, a mais próxima e o acesso à galeria no Perfil. Sem animações
 * contínuas, para não competir com personagem, XP, Radar e pilares.
 */
export function AchievementsSummary({
  achievements,
  onOpen,
}: {
  achievements: readonly AchievementStatus[];
  onOpen: () => void;
}) {
  const totals = achievementTotals(achievements);
  const recent = recentAchievements(achievements, 3);
  const nearest = nearestAchievement(achievements);
  return (
    <section
      aria-label="Conquistas"
      className="panel achievements-summary p-5 sm:p-6"
    >
      <SectionHeading title="Conquistas" eyebrow="Suas conquistas">
        <span className="achievements-summary__count">
          {totals.unlocked}/{totals.total}
        </span>
      </SectionHeading>
      <div className="achievements-summary__layout">
        <div className="achievements-summary__overview">
          <div className="achievements-summary__totals">
            <p>
              <strong>{totals.unlocked}</strong> de {totals.total} desbloqueadas
            </p>
            <p className="achievements-summary__percent">{totals.percent}%</p>
          </div>
          <ProgressBar
            label="Conclusão das conquistas"
            value={totals.unlocked}
            max={totals.total}
          />
        </div>
        {recent.length > 0 ? (
          <ul
            className="achievements-summary__recent"
            aria-label="Conquistas recentes"
          >
            {recent.map((status) => (
              <li key={status.id} data-rarity={status.rarity}>
                <AchievementMedal status={status} size="sm" />
                <span>
                  <strong>{status.title}</strong>
                  <span
                    className="achievement-rarity"
                    data-rarity={status.rarity}
                  >
                    {rarityLabels[status.rarity]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="achievements-summary__empty">
            Nenhuma conquista ainda. Registre uma atividade em qualquer pilar
            para desbloquear a primeira.
          </p>
        )}
        {nearest && (
          <div className="achievements-summary__nearest">
            <p className="eyebrow">Mais próxima</p>
            <div className="achievements-summary__nearest-row">
              <AchievementMedal status={nearest} size="sm" />
              <div>
                <p className="achievements-summary__nearest-title">
                  {nearest.title}
                </p>
                <ProgressBar
                  label={`Progresso de ${nearest.title}`}
                  value={nearest.current}
                  max={nearest.target}
                />
                <p className="achievements-summary__nearest-progress">
                  {nearest.progress}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="achievements-summary__action">
          <ActionButton icon="chevron" onClick={onOpen}>
            Ver conquistas
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
