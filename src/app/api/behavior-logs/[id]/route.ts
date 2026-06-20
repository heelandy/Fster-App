import { item } from '@/lib/household-resource';
import { behaviorLogResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { PATCH, DELETE } = item(behaviorLogResource);
