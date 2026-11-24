import type { Ability, ActivityEntry } from '@shared/types';
import { useState } from 'react';
import { ErrorState } from '@/components/sections/ErrorState';
import { Card } from '@/components/ui/Card';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { formatDateTime } from '@/lib/format';
import { listActivity } from '@/services/activityService';
import { pageTitle } from '@/lib/pageTitle';
import { listAbilities, setAbility } from '@/services/abilityService';
import { ApiError } from '@/services/apiClient';
import { Badge } from '@/components/ui/Badge';
import { ABILITY_DETAILS } from '@/config/abilities';
import styles from './PermissionsPage.module.css';
import { PageHeader } from '@/components/ui/PageHeader';

const loadAbilities = async () => (await listAbilities()).abilities;
const loadActivity = async () => (await listActivity()).entries;

const RUN_LABELS: Record<ActivityEntry['kind'], string> = {
  read: 'Read',
  proposed: 'Suggested',
  approved: 'Done after approval',
  rejected: 'Rejected by you',
  blocked: 'Blocked (switched off)',
  failed: 'Failed',
  edited: 'Edited by you',
};

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
  const activity = usePolling(loadActivity);
  // The newest log entry per tool: its real last run (the log is newest first).
  const lastRun = new Map<string, ActivityEntry>();
  if (activity.status === 'success') {
    for (const entry of activity.data)
      if (entry.tool && !lastRun.has(entry.tool)) lastRun.set(entry.tool, entry);
  }
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
      <title>{pageTitle('MCP tools')}</title>
      <PageHeader
        title="MCP tools"
        description="Every tool your AI assistant can use through CampusMate: what it does, whether it needs your approval, when it last ran, and a switch to turn it off. Changes apply immediately."
      />
      <output className={styles.message}>{message}</output>

      {abilities.status === 'loading' && <StatusMessage variant="loading" title="Loading tools…" />}
      {abilities.status === 'error' && (
        <ErrorState what="Your tools" error={abilities.error} onRetry={abilities.retry} />
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
                      description={
                        ABILITY_DETAILS[ability.name] && (
                          <>
                            <span className={styles.toolLine}>
                              <code className={styles.tool}>
                                {ABILITY_DETAILS[ability.name].tool}
                              </code>
                              <Badge tone={group === 'read' ? 'neutral' : 'info'}>
                                {group === 'read' ? 'Read-only' : 'Needs your approval'}
                              </Badge>
                            </span>
                            {ABILITY_DETAILS[ability.name].detail}
                            <span className={styles.lastRun}>
                              {lastRun.get(ability.name)
                                ? `Last run: ${RUN_LABELS[lastRun.get(ability.name)!.kind]}, ${formatDateTime(lastRun.get(ability.name)!.at)}`
                                : activity.status === 'success'
                                  ? 'Not used yet'
                                  : ''}
                            </span>
                          </>
                        )
                      }
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
