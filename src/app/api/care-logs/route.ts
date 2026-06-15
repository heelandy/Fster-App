import { collection } from '@/lib/household-resource';
import { careLogResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(careLogResource);
