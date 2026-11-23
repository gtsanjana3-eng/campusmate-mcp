import { useId, useState } from 'react';
import { Button } from './Button';
import styles from './CopyField.module.css';

type CopyFieldProps = {
  label: string;
  value: string;
  /** Hide the value until the student chooses to show it (for tokens). */
  secret?: boolean;
};

/** A read-only value with a copy button; the result is announced to screen readers. */
export function CopyField({ label, value, secret = false }: CopyFieldProps) {
  const valueId = useId();
  const [isRevealed, setIsRevealed] = useState(!secret);
  const [status, setStatus] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch {
      setStatus(`Couldn't copy automatically. Select the text and copy it instead.`);
      setIsRevealed(true);
    }
  };

  return (
    <div className={styles.field}>
      <span id={`${valueId}-label`} className={styles.label}>
        {label}
      </span>
      <code id={valueId} className={styles.value} aria-labelledby={`${valueId}-label`}>
        {isRevealed ? value : '•'.repeat(24)}
      </code>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void copy()} aria-describedby={valueId}>
          Copy {label.toLowerCase()}
        </Button>
        {secret && (
          <Button variant="secondary" onClick={() => setIsRevealed((shown) => !shown)}>
            {isRevealed ? 'Hide' : 'Show'} {label.toLowerCase()}
          </Button>
        )}
      </div>
      {/* <output> is a native live region (role="status"), so the result is announced. */}
      <output className={styles.status}>{status}</output>
    </div>
  );
}
