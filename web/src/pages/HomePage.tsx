import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { SITE_DESCRIPTION, SITE_NAME } from '@/config/site';
import { pageTitle } from '@/lib/pageTitle';
import styles from './HomePage.module.css';

const HIGHLIGHTS = [
  { title: 'Responsive', text: 'Mobile-first layouts that adapt to tablet and desktop.' },
  { title: 'Accessible', text: 'Semantic HTML, keyboard support and visible focus styles.' },
  { title: 'Ready for a backend', text: 'All data flows through a service layer.' },
];

export default function HomePage() {
  return (
    <>
      <title>{pageTitle()}</title>
      <section className="container">
        <div className={styles.hero}>
          <h1 className={styles.heading}>{SITE_NAME}</h1>
          <p className={styles.lead}>{SITE_DESCRIPTION}</p>
          <Link to={ROUTES.items} className={styles.cta}>
            View items
          </Link>
        </div>
      </section>

      <section className="container" aria-labelledby="highlights-heading">
        <h2 id="highlights-heading" className="visually-hidden">
          Highlights
        </h2>
        <div className={styles.grid}>
          {HIGHLIGHTS.map(({ title, text }) => (
            <Card key={title}>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardText}>{text}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
