import { item } from '@/lib/household-resource';
import { journalResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(journalResource);
