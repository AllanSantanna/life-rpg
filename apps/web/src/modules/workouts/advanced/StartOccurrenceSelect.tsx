import { CustomSelect } from '../../../shared/components/CustomSelect';
import { Field } from '../../records/RecordUI';

/**
 * Aparece só quando o horário informado ocorre duas vezes (fim do horário de
 * verão). O usuário escolhe a ocorrência; nada é decidido em silêncio.
 */
export function StartOccurrenceSelect({
  offsets,
  value,
  onChange,
}: {
  offsets: readonly string[];
  value: string;
  onChange: (offset: string) => void;
}) {
  if (offsets.length < 2) return null;
  return (
    <Field label="Ocorrência do horário">
      <CustomSelect
        label="Ocorrência do horário"
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: 'Escolha a ocorrência', disabled: true },
          ...offsets.map((offset, i) => ({
            value: offset,
            label: `${i === 0 ? 'Primeira' : 'Segunda'} ocorrência (UTC${offset})`,
          })),
        ]}
      />
    </Field>
  );
}
