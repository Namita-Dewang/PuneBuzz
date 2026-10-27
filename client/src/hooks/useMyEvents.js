import { useQuery } from '@tanstack/react-query';
import { getMyEvents } from '../api/events';

export default function useMyEvents() {
  return useQuery({ queryKey: ['me', 'events'], queryFn: getMyEvents });
}
