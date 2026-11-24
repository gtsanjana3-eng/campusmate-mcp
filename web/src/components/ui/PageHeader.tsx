import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

type PageHeaderProps = {
  title: string;
  /** One line saying what the page is for; every page has one, so the site reads consistently. */
  description: ReactNode;
};

/** The page's single h1 and its purpose, in the same place and style on every page. */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
