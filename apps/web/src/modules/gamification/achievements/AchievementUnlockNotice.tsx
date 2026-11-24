import { useEffect, useRef } from 'react';
import { ActionButton } from '../../../shared/components/ActionButton';
import { AchievementMedal } from './AchievementMedal';
import { achievementAsset } from './format';
import { rarityLabels } from './catalog';
import type { AchievementStatus } from './evaluate';

/** Dimensões intrínsecas das etiquetas (manifest.json), sem distorção. */
const labelSizes = {
  common: [145, 51],
  uncommon: [144, 51],
  rare: [137, 49],
  epic: [153, 52],
  legendary: [162, 58],
} as const;

/**
 * Notificação de desbloqueio: a medalha entra, a moldura da raridade acende e
 * nome e raridade aparecem. Não é modal: não bloqueia o formulário em uso nem
 * rouba o foco; o texto é anunciado por `role="status"`. Escape (com o foco
 * dentro) ou "Fechar" dispensam. Animações curtas, desativadas com
 * `prefers-reduced-motion`. Sem áudio.
 */
export function AchievementUnlockNotice({
  queue,
  onNext,
  onClose,
  onOpenGallery,
}: {
  queue: readonly AchievementStatus[];
  onNext: () => void;
  onClose: () => void;
  onOpenGallery?: () => void;
}) {
  const current = queue[0];
  const region = useRef<HTMLElement>(null);
  const hadFocus = useRef(false);
  // Ao avançar na fila com o foco dentro, mantém o foco na ação principal.
  useEffect(() => {
    if (hadFocus.current)
      region.current
        ?.querySelector<HTMLButtonElement>('.action-button')
        ?.focus();
  }, [current?.id]);
  if (!current) return null;
  const remaining = queue.length - 1;
  const rarity = rarityLabels[current.rarity];
  return (
    <section
      ref={region}
      className="achievement-unlock"
      data-rarity={current.rarity}
      aria-labelledby="achievement-unlock-title"
      onFocus={() => {
        hadFocus.current = true;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          hadFocus.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <p role="status" className="sr-only">
        {`Conquista desbloqueada: ${current.title}, raridade ${rarity}.`}
      </p>
      {/* `key` reinicia a animação a cada conquista da fila. */}
      <div className="achievement-unlock__stage" key={current.id}>
        <img
          className="achievement-unlock__burst"
          src={achievementAsset('effects/effect-unlock.webp')}
          alt=""
          width={114}
          height={114}
        />
        <img
          className="achievement-unlock__frame"
          src={achievementAsset(`frames/frame-${current.rarity}.webp`)}
          alt=""
          width={150}
          height={150}
        />
        <span className="achievement-unlock__medal">
          <AchievementMedal status={current} size="md" animated eager />
        </span>
      </div>
      <div className="achievement-unlock__body" key={`${current.id}-body`}>
        <p className="eyebrow" id="achievement-unlock-title">
          Conquista desbloqueada
        </p>
        <h2 className="achievement-unlock__name">{current.title}</h2>
        <img
          className="achievement-unlock__label"
          src={achievementAsset(`labels/label-${current.rarity}.webp`)}
          alt={`Raridade ${rarity}`}
          width={labelSizes[current.rarity][0]}
          height={labelSizes[current.rarity][1]}
        />
        <p className="achievement-unlock__description">{current.description}</p>
        {remaining > 0 && (
          <p className="achievement-unlock__more">
            {remaining === 1
              ? 'Mais 1 conquista desbloqueada'
              : `Mais ${remaining} conquistas desbloqueadas`}
          </p>
        )}
      </div>
      <div className="achievement-unlock__actions">
        {remaining > 0 ? (
          <ActionButton onClick={onNext}>Próxima</ActionButton>
        ) : (
          onOpenGallery && (
            <ActionButton
              onClick={() => {
                onClose();
                onOpenGallery();
              }}
            >
              Ver no Perfil
            </ActionButton>
          )
        )}
        <button
          type="button"
          className="filter-button"
          aria-label={
            remaining > 0
              ? 'Fechar todas as notificações de conquista'
              : `Fechar notificação de ${current.title}`
          }
          onClick={onClose}
        >
          {remaining > 0 ? 'Fechar todas' : 'Fechar'}
        </button>
      </div>
    </section>
  );
}
