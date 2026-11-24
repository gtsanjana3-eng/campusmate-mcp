import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AuthShell } from '@/components/sections/AuthShell';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ROUTES } from '@/config/routes';
import { REPOSITORY_URL } from '@/config/site';
import { authErrorMessage } from '@/lib/authErrors';
import { pageTitle } from '@/lib/pageTitle';
import { login } from '@/services/sessionService';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = (location.state as { from?: string } | null)?.from ?? ROUTES.home;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
      await navigate(returnTo, { replace: true });
    } catch (caught) {
      setError(authErrorMessage(caught));
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Sign in">
      <title>{pageTitle('Sign in')}</title>
      <p className={styles.lead}>
        Welcome back. Sign in to see your day and approve what your AI assistant wants to do.
      </p>
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className={styles.links}>
        New here? <Link to={ROUTES.signup}>Create an account</Link>
      </p>
      <p className={styles.help}>
        Need help?{' '}
        <a href={`${REPOSITORY_URL}#readme`} target="_blank" rel="noopener noreferrer">
          Read the setup guide
        </a>
      </p>
    </AuthShell>
  );
}
