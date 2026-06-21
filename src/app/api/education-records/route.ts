import { collection } from '@/lib/household-resource';
import { educationRecordResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(educationRecordResource);
