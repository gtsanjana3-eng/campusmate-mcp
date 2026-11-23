import { Outlet, ScrollRestoration } from 'react-router';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import styles from './MainLayout.module.css';

export function MainLayout() {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
