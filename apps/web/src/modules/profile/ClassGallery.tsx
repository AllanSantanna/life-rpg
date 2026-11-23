import { useId, useState } from 'react';
import { Icon } from '../../shared/components/Icon';
import type { ClassId } from './classes';
import {
  classCard,
  stageRequirement,
  stageTitle,
  visualClass,
  visualClasses,
  type VisualClass,
} from './classCards';
import {
  allStages,
  portraitCharacter,
  portraitStage,
  portraitStages,
  type PortraitCharacter,
  type PortraitStage,
} from './portraits';
import './classGallery.css';

/**
 * Read-only presentation of the class catalog and its 24 original cards.
 * Nothing here selects, unlocks or persists a class: the current class and
 * level come from the existing projection, and the card choice is local state.
 */
export function ClassGallery({
  classId,
  level,
  selected,
  onOpen,
  onShowAll,
  onBack,
}: {
  classId: ClassId | null;
  level: number;
  /** Class slug from the URL; unknown or absent shows the gallery. */
  selected: string | null;
  onOpen: (character: PortraitCharacter) => void;
  onShowAll: () => void;
  onBack: () => void;
}) {
  const current = portraitCharacter(classId);
  const stage = portraitStage(level);
  const detail = visualClass(selected);
  return (
    <div className="class-gallery-page">
      <button
        type="button"
        className="text-action class-gallery-back"
        onClick={detail ? onShowAll : onBack}
      >
        <Icon name="back" size={18} />
        {detail ? 'Voltar às classes' : 'Voltar ao Perfil'}
      </button>
      {detail ? (
        <ClassDetail
          key={detail.character}
          entry={detail}
          current={detail.character === current}
          level={level}
          stage={stage}
          onOpen={onOpen}
        />
      ) : (
        <section aria-labelledby="class-gallery-title">
          <div className="class-gallery-intro">
            <h2 id="class-gallery-title">Seis classes, quatro evoluções</h2>
            <p>
              A classe é definida automaticamente pelos seus registros e não
              pode ser escolhida. As cartas mostram o estágio do seu nível
              atual: nível {level}, estágio {stageTitle(stage)}.
            </p>
          </div>
          <ul className="class-gallery" aria-label="Classes do Life RPG">
            {visualClasses.map((entry) => (
              <ClassTile
                key={entry.character}
                entry={entry}
                current={entry.character === current}
                stage={stage}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CurrentBadge({ entry }: { entry: VisualClass }) {
  return (
    <span className="class-current-badge">
      <Icon name="check" size={14} />
      {entry.classId ? 'Classe atual' : 'Atual · sem classe definida'}
    </span>
  );
}

function ClassTile({
  entry,
  current,
  stage,
  onOpen,
}: {
  entry: VisualClass;
  current: boolean;
  stage: PortraitStage;
  onOpen: (character: PortraitCharacter) => void;
}) {
  const card = classCard(entry.character, stage);
  const titleId = useId();
  return (
    <li
      className="class-tile"
      data-class={entry.character}
      data-current={current || undefined}
      aria-labelledby={titleId}
    >
      <div className="class-card-frame">
        <img
          src={card.src}
          width={card.width}
          height={card.height}
          alt={`Carta de ${entry.name}, estágio ${stageTitle(stage)}`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="class-tile-body">
        {current && <CurrentBadge entry={entry} />}
        <h3 id={titleId}>{entry.name}</h3>
        <p className="class-pillar">
          <span>Pilar</span> {entry.pillar}
        </p>
        <button
          type="button"
          className="text-action"
          aria-label={`Ver detalhes de ${entry.name}`}
          onClick={() => onOpen(entry.character)}
        >
          Ver detalhes
          <Icon name="chevron" size={16} />
        </button>
      </div>
    </li>
  );
}

const statusLabels = {
  current: 'Estágio atual',
  reached: 'Alcançado',
  locked: 'Bloqueado',
} as const;
function stageState(card: PortraitStage, stage: PortraitStage) {
  if (card === stage) return 'current';
  return card < stage ? 'reached' : 'locked';
}

function ClassDetail({
  entry,
  current,
  level,
  stage,
  onOpen,
}: {
  entry: VisualClass;
  current: boolean;
  level: number;
  stage: PortraitStage;
  onOpen: (character: PortraitCharacter) => void;
}) {
  // Visual choice only: never persisted and never treated as a class change.
  const [shown, setShown] = useState<PortraitStage>(stage);
  const infoId = useId();
  const cover = classCard(entry.character, stage);
  return (
    <section
      className="class-detail"
      data-class={entry.character}
      aria-labelledby="class-detail-title"
    >
      <nav aria-label="Outras classes" className="class-switcher">
        {visualClasses.map((other) => (
          <button
            type="button"
            key={other.character}
            className={`filter-button ${other.character === entry.character ? 'active' : ''}`}
            data-class={other.character}
            aria-current={other.character === entry.character || undefined}
            onClick={() => onOpen(other.character)}
          >
            {other.name}
          </button>
        ))}
      </nav>
      <header className="class-detail-header panel">
        <div className="class-card-frame">
          <img
            src={cover.src}
            width={cover.width}
            height={cover.height}
            alt={`Carta de ${entry.name}, estágio ${stageTitle(stage)}`}
            decoding="async"
          />
        </div>
        <div className="class-detail-summary">
          {current && <CurrentBadge entry={entry} />}
          <h2 id="class-detail-title">{entry.name}</h2>
          <p className="class-description">{entry.description}</p>
          <dl className="class-facts">
            <div>
              <dt>Pilar associado</dt>
              <dd>{entry.pillar}</dd>
            </div>
            <div>
              <dt>Seu nível atual</dt>
              <dd>
                Nível {level} · estágio {stageTitle(stage)}
              </dd>
            </div>
          </dl>
          <h3>Como o sistema determina esta classe</h3>
          <ul className="class-rules">
            {entry.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </header>
      <section
        aria-labelledby="class-evolutions-title"
        className="class-evolutions"
      >
        <h3 id="class-evolutions-title">Evoluções de {entry.name}</h3>
        <p className="class-evolutions-hint">
          O estágio acompanha o nível do jogador. As cartas não podem ser
          desbloqueadas manualmente.
        </p>
        <ol className="class-evolution-list">
          {allStages.map((card) => {
            const image = classCard(entry.character, card);
            const state = stageState(card, stage);
            const status = statusLabels[state];
            return (
              <li key={card}>
                <button
                  type="button"
                  className="class-evolution"
                  data-status={state}
                  aria-pressed={shown === card}
                  aria-controls={infoId}
                  aria-label={`${entry.name}, estágio ${stageTitle(card)}, ${stageRequirement(card)}, ${status}`}
                  onClick={() => setShown(card)}
                >
                  <span className="class-card-frame">
                    <img
                      src={image.src}
                      width={image.width}
                      height={image.height}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span className="class-evolution-status">
                    {state === 'locked' && <Icon name="lock" size={14} />}
                    {state === 'current' && <Icon name="check" size={14} />}
                    {status}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div
          id={infoId}
          className="class-evolution-info panel"
          aria-live="polite"
        >
          <p className="eyebrow">Carta selecionada</p>
          <p className="class-evolution-name">
            {entry.name} · {portraitStages[shown]}
          </p>
          <dl className="class-facts">
            <div>
              <dt>Estágio</dt>
              <dd>{stageTitle(shown)}</dd>
            </div>
            <div>
              <dt>Requisito</dt>
              <dd>{stageRequirement(shown)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{statusLabels[stageState(shown, stage)]}</dd>
            </div>
          </dl>
        </div>
      </section>
    </section>
  );
}
