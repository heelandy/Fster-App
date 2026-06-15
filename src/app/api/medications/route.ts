import { collection } from '@/lib/household-resource';
import { medicationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(medicationResource);
