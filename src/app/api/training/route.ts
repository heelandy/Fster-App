import { collection } from '@/lib/household-resource';
import { trainingResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(trainingResource);
