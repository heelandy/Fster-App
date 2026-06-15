import { collection } from '@/lib/household-resource';
import { appointmentResource } from '@/lib/resources';

export const runtime = 'nodejs';
export const { GET, POST } = collection(appointmentResource);
