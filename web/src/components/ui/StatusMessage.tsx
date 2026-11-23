import type { ReactNode } from 'react';
import styles from './StatusMessage.module.css';

type StatusMessageProps = {
  variant: 'loading' | 'empty' | 'error';
  title: string;
  children?: ReactNode;
};

/** Shared loading / empty / error panel. Errors are announced immediately (role="alert"). */
export function StatusMessage({ variant, title, children }: StatusMessageProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-busy={variant === 'loading' || undefined}
      className={`${styles.message} ${styles[variant]}`}
    >
      {variant === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
      <p className={styles.title}>{title}</p>
      {children}
    </div>
  );
}
