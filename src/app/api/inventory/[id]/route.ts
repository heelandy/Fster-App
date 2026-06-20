import { item } from '@/lib/household-resource';
import { inventoryResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(inventoryResource);
