import { Icon } from '../../shared/components/Icon';
import './whatsNew.css';

/**
 * Acesso discreto às Novidades da versão no Perfil. Abre a mesma janela, sem
 * página nova, conexão ou alteração de dados pessoais.
 */
export function WhatsNewEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <section
      className="panel record-section whats-new-entry"
      aria-labelledby="whats-new-entry-title"
    >
      <div className="whats-new-entry__text">
        <h2 id="whats-new-entry-title">Novidades da versão</h2>
        <p className="record-hint">
          Consulte as melhorias da atualização mais recente.
        </p>
      </div>
      <button type="button" className="filter-button" onClick={onOpen}>
        <Icon name="sparkle" size={16} />
        Ver novidades
      </button>
    </section>
  );
}
