import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Props = Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'className' | 'style'
> & {
  children: ReactNode;
  icon?: IconName;
};

/** Ação primária com dimensões compartilhadas; não contém regras de domínio. */
export function ActionButton({
  children,
  icon,
  type = 'button',
  ...props
}: Props) {
  return (
    <button {...props} type={type} className="action-button">
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
