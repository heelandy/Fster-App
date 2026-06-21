import { item } from '@/lib/household-resource';
import { courtHearingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(courtHearingResource);
