import { item } from '@/lib/household-resource';
import { immunizationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(immunizationResource);
