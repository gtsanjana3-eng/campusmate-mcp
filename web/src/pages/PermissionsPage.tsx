import type { Ability } from '@shared/types';
import { useState } from 'react';
import { ErrorState } from '@/components/sections/ErrorState';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { useAsync } from '@/hooks/useAsync';
import { pageTitle } from '@/lib/pageTitle';
import { listAbilities, setAbility } from '@/services/abilityService';
import { ApiError } from '@/services/apiClient';
import styles from './PermissionsPage.module.css';

const loadAbilities = async () => (await listAbilities()).abilities;

const GROUPS = [
  {
    group: 'read',
    title: 'Reading',
    description: 'Your assistant can look these up straight away. Nothing is changed.',
  },
  {
    group: 'act',
    title: 'Acting',
    description:
      'Your assistant can only suggest these; each one waits for your approval. Switch one off to stop it even suggesting.',
  },
] as const;

/** One switch per MCP tool. The switch only moves once the server confirms the change. */
export default function PermissionsPage() {
  const abilities = useAsync(loadAbilities);
  // Server-confirmed values that override the first load, so the page never shows an unsaved state.
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [savingName, setSavingName] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const toggle = async (ability: Ability, enabled: boolean) => {
    setSavingName(ability.name);
    try {
      const { ability: saved } = await setAbility(ability.name, enabled);
      setConfirmed((current) => ({ ...current, [saved.name]: saved.enabled }));
      setMessage(`“${saved.label}” is now ${saved.enabled ? 'on' : 'off'}.`);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? `Couldn't change “${ability.label}”: ${error.message}`
          : `Couldn't change “${ability.label}”. Check your connection and try again.`,
      );
    } finally {
      setSavingName(null);
    }
  };

  return (
    <div className={`container ${styles.page}`}>
      <title>{pageTitle('Permissions')}</title>
      <h1 className={styles.heading}>Permissions</h1>
      <p className={styles.lead}>
        Choose what your AI assistant may do through CampusMate. Changes apply immediately.
      </p>
      <output className={styles.message}>{message}</output>

      {abilities.status === 'loading' && (
        <StatusMessage variant="loading" title="Loading permissions…" />
      )}
      {abilities.status === 'error' && (
        <ErrorState what="Your permissions" error={abilities.error} onRetry={abilities.retry} />
      )}
      {abilities.status === 'success' &&
        GROUPS.map(({ group, title, description }) => (
          <Card key={group} className={styles.group}>
            <h2 className={styles.groupTitle}>{title}</h2>
            <p className={styles.groupDescription}>{description}</p>
            <ul className={styles.list}>
              {abilities.data
                .filter((ability) => ability.group === group)
                .map((ability) => (
                  <li key={ability.name}>
                    <Switch
                      label={ability.label}
                      checked={confirmed[ability.name] ?? ability.enabled}
                      disabled={savingName === ability.name}
                      onChange={(next) => void toggle(ability, next)}
                    />
                  </li>
                ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
