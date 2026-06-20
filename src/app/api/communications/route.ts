import { collection } from '@/lib/household-resource';
import { communicationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(communicationResource);
