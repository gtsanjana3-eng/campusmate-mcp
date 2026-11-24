import type { ReactNode } from 'react';
import { CampusIllustration } from '@/components/ui/CampusIllustration';
import { REPOSITORY_URL } from '@/config/site';
import styles from './AuthShell.module.css';

const FEATURES = [
  [
    'Reads instantly',
    'Your AI assistant answers from your timetable, deadlines, attendance and notices.',
  ],
  ['Only suggests actions', 'Faculty emails, reminders and deadlines wait for you as cards.'],
  ['You decide', 'Approve, edit or reject every action, and choose which tools it may use.'],
] as const;

/** Split screen for logged-out pages: the campus story on the left, the form card on the right. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <section className={styles.story} aria-labelledby="story-heading">
        <h2 id="story-heading" className={styles.headline}>
          Your campus life, inside your AI assistant.
        </h2>
        <p className={styles.lead}>
          CampusMate connects Claude to your classes, deadlines, attendance and college notices
          through MCP, and nothing happens without your yes.
        </p>
        <CampusIllustration className={styles.art} />
        <ul className={styles.features}>
          {FEATURES.map(([name, text]) => (
            <li key={name}>
              <strong>{name}.</strong> {text}
            </li>
          ))}
        </ul>
        <p className={styles.demo}>
          This demo uses a sample student&apos;s data; emails go to a demo outbox.{' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            Source code and documentation
          </a>
          .
        </p>
      </section>

      <section className={styles.formSide}>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}
