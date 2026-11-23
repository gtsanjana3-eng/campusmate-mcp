import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { ROUTES } from '@/config/routes';
import { SITE_NAME } from '@/config/site';
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
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'That passcode is not right. Try again.'
          : 'CampusMate could not be reached. Check your connection and try again.',
      );
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
    </div>
  );
}
