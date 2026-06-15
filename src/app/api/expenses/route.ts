import { collection } from '@/lib/household-resource';
import { expenseResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(expenseResource);
