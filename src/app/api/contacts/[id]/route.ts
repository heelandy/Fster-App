import { item } from '@/lib/household-resource';
import { contactResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(contactResource);
