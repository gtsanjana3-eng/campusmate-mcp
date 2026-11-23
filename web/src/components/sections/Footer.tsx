import { SITE_NAME } from '@/config/site';
import styles from './Footer.module.css';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <p>
          © {CURRENT_YEAR} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
