import { item } from '@/lib/household-resource';
import { medicationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(medicationResource);
