import { useId, type ReactNode } from 'react';
import styles from './Switch.module.css';

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
};

/** An on/off toggle announced as a switch with its state ("on"/"off") to screen readers. */
export function Switch({ label, checked, onChange, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className={styles.description}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} aria-hidden="true" />
        <span className={styles.state} aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  );
}
