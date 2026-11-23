import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown under the field and announced to screen readers. */
  error?: string;
};

export function TextField({ label, error, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
