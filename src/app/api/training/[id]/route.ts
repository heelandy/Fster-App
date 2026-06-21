import { item } from '@/lib/household-resource';
import { trainingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(trainingResource);
