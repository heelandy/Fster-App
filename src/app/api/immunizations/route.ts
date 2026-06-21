import { collection } from '@/lib/household-resource';
import { immunizationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(immunizationResource);
