import { SITE_NAME } from '@/config/site';

export function pageTitle(page?: string): string {
  return page ? `${page} | ${SITE_NAME}` : SITE_NAME;
}
