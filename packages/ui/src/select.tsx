import type { SelectHTMLAttributes } from 'react';
import { fieldControlClass } from './field-styles';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select className={fieldControlClass(className)} {...props}>
      {children}
    </select>
  );
}
