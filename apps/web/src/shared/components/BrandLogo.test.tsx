import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { BrandLogo } from './BrandLogo';

afterEach(cleanup);
it.each([false, true])(
  'identifica a marca acessível na variante compacta=%s',
  (compact) => {
    const { container } = render(<BrandLogo compact={compact} />);
    expect(screen.getByRole('img', { name: 'Life RPG' })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}icons/icon.svg`,
    );
    expect(container.querySelector('.brand-logo__name') !== null).toBe(
      !compact,
    );
  },
);
