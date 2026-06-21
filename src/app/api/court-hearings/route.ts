import { collection } from '@/lib/household-resource';
import { courtHearingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(courtHearingResource);
