import { item } from '@/lib/household-resource';
import { expenseResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(expenseResource);
