import { collection } from '@/lib/household-resource';
import { inventoryResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(inventoryResource);
