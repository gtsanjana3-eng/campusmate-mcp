import type { Ability, AbilityName } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';
import { abilityDisabled, notFound } from './errors.ts';

export function listAbilities(store: Store): Ability[] {
  return store.listAbilities();
}

export function setAbility(store: Store, name: string, enabled: boolean): Ability {
  if (!store.getAbility(name)) throw notFound('Ability');
  return store.setAbilityEnabled(name, enabled, new Date().toISOString()) as Ability;
}

/** Throws a plain-language error when the student has switched this ability off. */
export function requireAbility(store: Store, name: AbilityName): Ability {
  const ability = store.getAbility(name);
  if (!ability) throw notFound('Ability');
  if (!ability.enabled) throw abilityDisabled(ability.label);
  return ability;
}
