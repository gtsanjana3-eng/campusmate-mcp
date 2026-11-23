import items from '@/data/items.json';
import type { Item } from '@/types/item';

/**
 * Pages call these functions and never touch data/ or fetch directly.
 * To use a backend, replace the body with: return apiRequest<Item[]>('/items');
 */
export async function getItems(): Promise<Item[]> {
  return items;
}
