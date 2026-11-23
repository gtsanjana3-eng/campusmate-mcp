import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { NAV_LINKS, ROUTES } from '@/config/routes';
import { SITE_NAME } from '@/config/site';
import styles from './Header.module.css';

export function Header() {
  const { pathname } = useLocation();
  // Storing the path the menu was opened on closes it automatically after navigation.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const isMenuOpen = openOnPath === pathname;

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenOnPath(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to={ROUTES.home} className={styles.brand}>
          {SITE_NAME}
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={isMenuOpen}
          aria-controls="primary-nav"
          onClick={() => setOpenOnPath(isMenuOpen ? null : pathname)}
        >
          <span className="visually-hidden">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              d={isMenuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <nav
          id="primary-nav"
          aria-label="Primary"
          className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}
        >
          <ul className={styles.list}>
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} end className={styles.link}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
