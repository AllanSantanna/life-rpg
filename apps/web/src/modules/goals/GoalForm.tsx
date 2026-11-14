import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { useState } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { pillarIcons } from './questList';
import { Actions, Field, RecordForm } from '../records/RecordUI';
import { formText } from '../records/form';
import { decimalToUnits } from '../finances/monetary';
import { MoneyInput } from '../finances/MoneyInput';
import {
  goalPillars,
  metrics,
  type GoalDefinition,
  type GoalMetric,
} from './types';
export function GoalForm({
  value,
  today,
  onSave,
  onCancel,
  editing,
}: {
  value: GoalDefinition;
  today: string;
  onSave: (value: GoalDefinition) => string | null;
  onCancel: () => void;
  editing: boolean;
}) {
  const [pillar, setPillar] = useState(value.pillar),
    [kind, setKind] = useState(value.kind),
    [tracking, setTracking] = useState(value.tracking),
    [metric, setMetric] = useState<GoalMetric | null>(value.metric),
    [unit, setUnit] = useState(value.unit),
    [cadence, setCadence] = useState(value.cadence),
    [difficulty, setDifficulty] = useState(value.difficulty);
  const customUnit = ![
    'dias',
    'vezes',
    'páginas',
    'horas',
    'reais',
    'percentual',
  ].includes(unit);
  return (
    <RecordForm
      title={editing ? 'Editar minha quest' : 'Criar minha quest'}
      onSubmit={(data) =>
        onSave({
          title: formText(data, 'title'),
          description: formText(data, 'description'),
          pillar,
          kind,
          target:
            kind === 'completion'
              ? 1000
              : decimalToUnits(formText(data, 'target'), 3),
          unit:
            tracking === 'automatic' && metric
              ? metrics[metric].unit
              : kind === 'completion'
                ? 'vezes'
                : customUnit
                  ? formText(data, 'customUnit')
                  : unit,
          startDate: formText(data, 'startDate'),
          deadline: formText(data, 'deadline') || null,
          cadence,
          customDays:
            cadence === 'custom' ? Number(formText(data, 'customDays')) : 7,
          tracking,
          metric: tracking === 'automatic' ? metric : null,
          difficulty: formText(
            data,
            'difficulty',
          ) as GoalDefinition['difficulty'],
        })
      }
    >
      {editing && (
        <p className="record-hint">
          Alterações recalculam ciclos, progresso e XP. Os registros dos pilares
          e as versões anteriores da configuração são preservados. Mudar tipo,
          unidade, início ou frequência exige novos totais manuais; os valores
          antigos continuam no histórico.
        </p>
      )}
      <div className="record-fields">
        <Field label="Título da quest">
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={value.title}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            name="description"
            maxLength={1000}
            defaultValue={value.description}
          />
        </Field>
        <Field label="Pilar da quest">
          <CustomSelect
            label="Pilar da quest"
            value={pillar}
            options={goalPillars.map((p) => ({
              value: p,
              label: p,
              icon: pillarIcons[p],
              area: p,
            }))}
            onChange={(next) => {
              setPillar(next);
              setTracking('manual');
              setMetric(null);
            }}
          />
        </Field>
        <Field label="Tipo de quest">
          <CustomSelect
            label="Tipo de quest"
            value={kind}
            options={[
              { value: 'quantity', label: 'Quantitativa · atingir um alvo' },
              { value: 'completion', label: 'Conclusão simples' },
            ]}
            onChange={(next) => {
              setKind(next);
              if (next === 'completion') {
                setTracking('manual');
                setMetric(null);
              }
            }}
          />
        </Field>
        <Field label="Acompanhamento">
          <CustomSelect
            label="Acompanhamento"
            value={tracking}
            options={[
              { value: 'manual', label: 'Manual' },
              {
                value: 'automatic',
                label: 'Automático por registros',
                disabled: kind === 'completion' || pillar === 'Geral',
              },
            ]}
            onChange={(next) => {
              setTracking(next);
              if (next === 'automatic') {
                const first = (Object.keys(metrics) as GoalMetric[]).find(
                  (key) => metrics[key].pillar === pillar,
                )!;
                setMetric(first);
                setUnit(metrics[first].unit);
              }
            }}
          />
        </Field>
        {tracking === 'automatic' && (
          <Field label="Indicador automático">
            <CustomSelect
              label="Indicador automático"
              value={metric ?? ''}
              options={(
                Object.entries(metrics) as [
                  GoalMetric,
                  (typeof metrics)[GoalMetric],
                ][]
              )
                .filter(([, m]) => m.pillar === pillar)
                .map(([key, m]) => ({ value: key, label: m.label }))}
              onChange={(next) => {
                setMetric(next as GoalMetric);
                setUnit(metrics[next as GoalMetric].unit);
              }}
            />
          </Field>
        )}
        {kind === 'quantity' && (
          <>
            {tracking === 'manual' && (
              <Field label="Unidade da quest">
                <CustomSelect
                  label="Unidade da quest"
                  value={customUnit ? 'custom' : unit}
                  options={[
                    ...[
                      'dias',
                      'vezes',
                      'páginas',
                      'horas',
                      'reais',
                      'percentual',
                    ].map((u) => ({ value: u, label: u })),
                    { value: 'custom', label: 'Outra unidade' },
                  ]}
                  onChange={(next) =>
                    setUnit(next === 'custom' ? 'etapas' : next)
                  }
                />
              </Field>
            )}
            {tracking === 'manual' && customUnit && (
              <Field label="Unidade personalizada">
                <input
                  name="customUnit"
                  required
                  maxLength={40}
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                />
              </Field>
            )}
            <Field label={`Alvo (${unit})`}>
              {unit === 'reais' ? (
                <MoneyInput
                  key="money-target"
                  name="target"
                  required
                  defaultValue={(value.target / 1000).toFixed(2)}
                />
              ) : (
                <input
                  key="number-target"
                  name="target"
                  required
                  inputMode="decimal"
                  defaultValue={(value.target / 1000).toLocaleString('pt-BR', {
                    useGrouping: false,
                    maximumFractionDigits: 3,
                  })}
                />
              )}
            </Field>
          </>
        )}
        <Field label="Data de início">
          <CustomDatePicker
            label="Data de início"
            name="startDate"
            required
            defaultValue={value.startDate || today}
          />
        </Field>
        <Field label="Prazo (opcional)">
          <CustomDatePicker
            label="Prazo (opcional)"
            name="deadline"
            defaultValue={value.deadline ?? ''}
          />
        </Field>
        <Field label="Frequência">
          <CustomSelect
            label="Frequência"
            value={cadence}
            options={[
              { value: 'once', label: 'Única / até o prazo' },
              { value: 'daily', label: 'Diária' },
              { value: 'weekly', label: 'Semanal' },
              { value: 'monthly', label: 'Mensal' },
              { value: 'custom', label: 'Personalizada' },
            ]}
            onChange={setCadence}
          />
        </Field>
        {cadence === 'custom' && (
          <Field label="Dias por ciclo">
            <input
              name="customDays"
              type="number"
              min={1}
              max={3650}
              required
              defaultValue={value.customDays}
            />
          </Field>
        )}
        <Field label="Dificuldade e XP potencial">
          <CustomSelect
            label="Dificuldade e XP potencial"
            name="difficulty"
            value={difficulty}
            options={[
              { value: 'easy', label: 'Leve · até 10 XP' },
              { value: 'medium', label: 'Moderada · até 25 XP' },
              { value: 'hard', label: 'Alta · até 50 XP' },
            ]}
            onChange={setDifficulty}
          />
        </Field>
      </div>
      <p className="record-hint">
        Quests quantitativas concluem ao atingir ou ultrapassar o alvo. Para
        limites máximos de gastos, use acompanhamento manual. Nenhum modelo é
        obrigatório. Semanas vão de segunda a domingo; meses seguem o
        calendário. O primeiro/último ciclo pode ser parcial. Sono soma horas no
        ciclo; use frequência diária para uma quest por noite. Saldo e
        patrimônio são posições, não receitas ou aportes, e não geram XP de
        quest.
      </p>
      <p className="record-hint">
        XP de quests: até 50 por dia e 100 por semana, com deduplicação. Quests
        dos pilares compartilham o teto diário com registros e missões. Criar
        uma quest não dá XP. Geral não altera o Radar.
      </p>
      <Actions
        submit={editing ? 'Salvar quest' : 'Confirmar criação da quest'}
        onCancel={onCancel}
      />
    </RecordForm>
  );
}
