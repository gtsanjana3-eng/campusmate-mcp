import styles from './CampusIllustration.module.css';

/**
 * A drawn university campus: a clock-tower hall with columns, trees, a path and students.
 * Decorative only (aria-hidden); colours come from the design tokens so it matches every page.
 */
export function CampusIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`${styles.art} ${className}`}
      viewBox="0 0 480 300"
      aria-hidden="true"
      focusable="false"
    >
      {/* Sky, sun and hills */}
      <rect className={styles.sky} width="480" height="300" />
      <circle className={styles.sun} cx="392" cy="62" r="26" />
      <path className={styles.hillFar} d="M0 210 Q120 160 240 196 T480 180 V300 H0Z" />

      {/* Side wings */}
      <rect className={styles.stone} x="70" y="150" width="110" height="80" />
      <rect className={styles.stone} x="300" y="150" width="110" height="80" />
      <path className={styles.roof} d="M62 152 L125 128 L188 152Z" />
      <path className={styles.roof} d="M292 152 L355 128 L418 152Z" />
      {[84, 112, 140, 314, 342, 370].map((x) => (
        <g key={x}>
          <rect className={styles.window} x={x} y="166" width="16" height="22" rx="8" />
          <rect className={styles.window} x={x} y="198" width="16" height="22" rx="2" />
        </g>
      ))}

      {/* Main hall with columns and pediment */}
      <rect className={styles.stoneLight} x="170" y="140" width="140" height="92" />
      <path className={styles.roof} d="M160 142 L240 104 L320 142Z" />
      <path className={styles.trim} d="M178 140 L240 112 L302 140" />
      {[184, 210, 236, 262, 288].map((x) => (
        <rect key={x} className={styles.column} x={x} y="148" width="9" height="76" />
      ))}
      <rect className={styles.stone} x="166" y="226" width="148" height="8" />
      <rect className={styles.door} x="228" y="190" width="24" height="36" rx="12" />

      {/* Clock tower with dome */}
      <rect className={styles.stoneLight} x="222" y="60" width="36" height="50" />
      <path className={styles.dome} d="M216 62 Q240 22 264 62Z" />
      <rect className={styles.gold} x="238" y="18" width="4" height="16" />
      <circle className={styles.clock} cx="240" cy="82" r="11" />
      <path className={styles.hands} d="M240 82 V74 M240 82 L246 85" />

      {/* Trees */}
      {[
        [40, 196, 34],
        [100, 214, 22],
        [430, 196, 32],
        [382, 216, 22],
      ].map(([x, y, r]) => (
        <g key={x}>
          <rect className={styles.trunk} x={x - 3} y={y} width="6" height={r + 8} />
          <circle className={r > 30 ? styles.leafDark : styles.leaf} cx={x} cy={y} r={r} />
        </g>
      ))}

      {/* Lawn and path */}
      <path className={styles.lawn} d="M0 236 H480 V300 H0Z" />
      <path className={styles.path} d="M226 236 L254 236 L300 300 L180 300Z" />

      {/* Students */}
      <g className={styles.person}>
        <circle cx="150" cy="248" r="7" />
        <path d="M141 284 Q141 258 150 258 Q159 258 159 284Z" />
        <rect className={styles.bag} x="156" y="262" width="7" height="12" rx="2" />
      </g>
      <g className={styles.personGold}>
        <circle cx="330" cy="246" r="7" />
        <path d="M321 284 Q321 256 330 256 Q339 256 339 284Z" />
        <rect className={styles.book} x="314" y="262" width="10" height="8" rx="1" />
      </g>
      <g className={styles.person}>
        <circle cx="352" cy="250" r="6" />
        <path d="M344 284 Q344 260 352 260 Q360 260 360 284Z" />
      </g>
    </svg>
  );
}
