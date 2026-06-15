import { collection } from '@/lib/household-resource';
import { licensingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(licensingResource);
