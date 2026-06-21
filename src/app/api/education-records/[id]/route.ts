import { item } from '@/lib/household-resource';
import { educationRecordResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(educationRecordResource);
