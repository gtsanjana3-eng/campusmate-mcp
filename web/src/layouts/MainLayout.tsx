import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import styles from './MainLayout.module.css';

export function MainLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);

  // After a client-side page change, move focus to the new page's heading so keyboard and
  // screen-reader users land on (and hear) the new page. The first load is left alone.
  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) heading.tabIndex = -1;
    (heading ?? mainRef.current)?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
