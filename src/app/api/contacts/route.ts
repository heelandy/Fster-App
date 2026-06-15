import { collection } from '@/lib/household-resource';
import { contactResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(contactResource);
