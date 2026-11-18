import { Icon } from '../../shared/components/Icon';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { SectionHeading } from '../../shared/components/SectionHeading';
import type { Attribute } from './types';
export function AttributesPanel({ attributes }: { attributes: Attribute[] }) {
  return (
    <section aria-label="Atributos do jogador" className="mb-9">
      <SectionHeading title="Seus atributos" eyebrow="Cada ação constrói você">
        <span className="text-xs text-muted">Dedicação real · 7 dias</span>
      </SectionHeading>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {attributes.map((attribute) => (
          <article className="panel p-4 sm:p-5" key={attribute.name}>
            <div className="mb-4 flex items-center gap-2 text-muted">
              <Icon name={attribute.icon} size={16} className="shrink-0" />
              <h3 className="text-sm">{attribute.name}</h3>
            </div>
            <div className="mb-3 flex items-baseline gap-1.5">
              <strong className="text-2xl font-semibold tracking-tight">
                {attribute.value}
              </strong>
              <span className="text-xs text-muted">/ {attribute.max}</span>
            </div>
            <ProgressBar
              label={attribute.name}
              value={attribute.value}
              max={attribute.max}
            />
            <p className="mt-3 hidden text-xs text-muted sm:block">
              {attribute.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
