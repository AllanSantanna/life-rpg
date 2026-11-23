import {
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react';
import type { PlayerState } from '../../app/playerState';
import { ActionButton } from '../../shared/components/ActionButton';
import { PlayerHeader } from './PlayerHeader';
import { renameCharacter, type CharacterProjection } from './character';

export function ProfilePage({
  state,
  facts,
  onChange,
  onOpenEvolution,
  onExploreClasses,
}: {
  state: PlayerState;
  facts: CharacterProjection;
  onChange: Dispatch<SetStateAction<PlayerState>>;
  onOpenEvolution: () => void;
  onExploreClasses: () => void;
}) {
  const [name, setName] = useState(state.profile.name);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function saveName(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const next = renameCharacter(state, name);
      onChange((previous) => renameCharacter(previous, name));
      setName(next.profile.name);
      setMessage('Nome salvo neste perfil.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Confira o nome.');
    }
  }
  return (
    <div className="character-sheet">
      <PlayerHeader
        player={state.profile}
        character={state.character}
        progress={facts.progress}
        dedication={facts.dedication}
        onOpenEvolution={onOpenEvolution}
        variant="profile"
        actions={
          <ActionButton icon="grid" onClick={onExploreClasses}>
            Explorar classes
          </ActionButton>
        }
      />
      <section aria-label="Nome do jogador" className="panel profile-settings">
        <form onSubmit={saveName} className="profile-name-form">
          <label htmlFor="character-name">Nome do jogador</label>
          <div>
            <input
              id="character-name"
              value={name}
              maxLength={40}
              required
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'character-name-error' : undefined}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
            <button className="profile-save" type="submit">
              Salvar nome
            </button>
          </div>
        </form>
        {error && (
          <p id="character-name-error" className="record-error" role="alert">
            {error}
          </p>
        )}
        <p className="profile-feedback" role="status">
          {message}
        </p>
      </section>
    </div>
  );
}
