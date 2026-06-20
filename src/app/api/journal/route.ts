import { collection } from '@/lib/household-resource';
import { journalResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(journalResource);
