import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthShell } from '@/components/sections/AuthShell';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ROUTES } from '@/config/routes';
import { authErrorMessage } from '@/lib/authErrors';
import { pageTitle } from '@/lib/pageTitle';
import { signUp } from '@/services/sessionService';
import styles from './AuthPage.module.css';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.inviteCode) {
      setError('Fill in every field.');
      return;
    }
    if (form.password.length < 12) {
      setError('Use a password of at least 12 characters.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await signUp({ ...form, name: form.name.trim(), email: form.email.trim() });
      await navigate(ROUTES.home, { replace: true });
    } catch (caught) {
      setError(authErrorMessage(caught));
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Create an account">
      <title>{pageTitle('Create an account')}</title>
      <p className={styles.lead}>
        You need the invite code from whoever runs this CampusMate server.
      </p>
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <TextField label="Your name" autoComplete="name" {...field('name')} required />
        <TextField label="Email" type="email" autoComplete="email" {...field('email')} required />
        <TextField
          label="Password (at least 12 characters)"
          type="password"
          autoComplete="new-password"
          {...field('password')}
          required
        />
        <TextField
          label="Invite code"
          type="password"
          autoComplete="off"
          {...field('inviteCode')}
          error={error}
          required
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
      <p className={styles.links}>
        Already have an account? <Link to={ROUTES.login}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
