import { FinanceHelp } from './FinanceHelp';
import { Disclosure } from '../../shared/components/Disclosure';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { FinancialConfirmation } from './FinancialConfirmation';
import { Field } from '../records/RecordUI';
import { Icon } from '../../shared/components/Icon';
export function FinancialSettings({
  onCommand,
}: Pick<RecordPageProps, 'onCommand'>) {
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const close = () => {
    setOpened(false);
    setConfirmation('');
    setError('');
  };
  return (
    <Disclosure
      title="Configurações financeiras"
      className="panel record-section financial-settings"
      help={<FinanceHelp topic="settings" />}
    >
      <h3>Redefinir dados financeiros</h3>
      <p>
        Apague o histórico de Finanças e recomece. Os demais pilares e o perfil
        serão preservados.
      </p>
      <button
        type="button"
        className="financial-danger"
        onClick={() => {
          setMessage('');
          setOpened(true);
        }}
      >
        <Icon name="trash" size={16} />
        Redefinir dados financeiros
      </button>
      <p role="status">{message}</p>
      {opened && (
        <FinancialConfirmation
          title="Redefinir dados financeiros"
          onCancel={close}
        >
          <p>
            Esta ação é irreversível. Todas as contas, saldos iniciais,
            receitas, despesas, investimentos, compras e vendas de Bitcoin,
            aportes, retiradas, transferências, avaliações e cotações usadas no
            histórico financeiro serão apagados.
          </p>
          <p>
            O patrimônio, os gráficos, o XP e o Radar serão recalculados.
            Treinos, Descanso, Conhecimento, Perfil e missões serão preservados.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (confirmation !== 'ZERAR') return;
              const failure = onCommand({
                type: 'resetFinances',
                confirmation,
              });
              if (failure) setError(failure);
              else {
                close();
                setMessage(
                  'Dados financeiros redefinidos. Os demais pilares foram preservados.',
                );
              }
            }}
          >
            <Field label="Digite ZERAR para confirmar">
              <input
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            {error && (
              <p role="alert" className="record-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="financial-danger"
              disabled={confirmation !== 'ZERAR'}
            >
              Apagar todos os dados financeiros
            </button>
          </form>
        </FinancialConfirmation>
      )}
    </Disclosure>
  );
}
