import styles from './Logo.module.css';

/** CampusMate's mark: a graduation cap. Decorative; the brand name next to it is the text. */
export function Logo() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M12 4 2 9l10 5 10-5-10-5Z" fill="currentColor" />
        <path
          d="M6 11.2V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M21 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
