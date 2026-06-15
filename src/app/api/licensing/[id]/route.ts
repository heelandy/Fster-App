import { item } from '@/lib/household-resource';
import { licensingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(licensingResource);
