import { item } from '@/lib/household-resource';
import { careLogResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(careLogResource);
