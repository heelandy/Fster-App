import { item } from '@/lib/household-resource';
import { communicationResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(communicationResource);
