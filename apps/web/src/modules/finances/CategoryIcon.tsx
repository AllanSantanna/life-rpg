import { Icon, type IconName } from '../../shared/components/Icon';
import type { InvestmentCategory } from './types';
const icons: Record<InvestmentCategory, IconName> = {
  Ações: 'chart',
  'Fundos imobiliários': 'building',
  'Renda fixa': 'shield',
  'Caixinhas bancárias': 'safe',
  Bitcoin: 'bitcoin',
  'Dólar (USD)': 'dollar',
  Outros: 'wallet',
};
export function CategoryIcon({ category }: { category: InvestmentCategory }) {
  return (
    <Icon
      name={icons[category]}
      size={16}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        marginRight: 6,
        color: category === 'Bitcoin' ? 'var(--color-bitcoin)' : 'currentColor',
      }}
    />
  );
}
