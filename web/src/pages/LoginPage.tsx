import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { ROUTES } from '@/config/routes';
import { REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME } from '@/config/site';
import { pageTitle } from '@/lib/pageTitle';
import { ApiError } from '@/services/apiClient';
import { login } from '@/services/sessionService';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from ?? ROUTES.home;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setError('Enter your passcode.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await login(passcode);
      await navigate(returnTo, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError('That passcode is not right. Try again.');
      } else if (caught instanceof ApiError && caught.status === 429) {
        // The server's message says how long to wait.
        setError(caught.message);
      } else {
        setError('CampusMate could not be reached. Check your connection and try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Log in')}</title>
      <Card className={styles.card}>
        <h1 className={styles.heading}>Log in to {SITE_NAME}</h1>
        <p className={styles.lead}>
          Your dashboard is where you approve what the AI wants to do and choose what it may access.
        </p>
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <TextField
            label="Passcode"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            error={error}
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </Card>

      <section className={styles.about} aria-labelledby="about-heading">
        <h2 id="about-heading" className={styles.aboutHeading}>
          What is {SITE_NAME}?
        </h2>
        <p>{SITE_DESCRIPTION}</p>
        <ul className={styles.points}>
          <li>
            <strong>Reads instantly.</strong> Your AI assistant (for example Claude) connects
            through MCP and answers from your timetable, deadlines, attendance and notices.
          </li>
          <li>
            <strong>Only suggests actions.</strong> Faculty emails, reminders and new deadlines wait
            here as cards.
          </li>
          <li>
            <strong>You decide.</strong> Approve, edit or reject each one, and switch off anything
            the assistant may use.
          </li>
        </ul>
        <p className={styles.note}>
          This demo uses a sample student&apos;s data; emails go to a demo outbox.{' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            Source code and documentation
          </a>
          .
        </p>
      </section>
    </div>
  );
}
