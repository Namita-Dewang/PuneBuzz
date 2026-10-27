import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createVenue, listVenues } from '../api/venues';

export default function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: listVenues,
    staleTime: 5 * 60_000, // venues rarely change
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVenue,
    // Add it to the cached list right away so the select can show it.
    onSuccess: (venue) => {
      queryClient.setQueryData(['venues'], (venues) => (venues ? [...venues, venue] : [venue]));
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

// Distinct venue areas, alphabetical, for the area filter.
export function useAreas() {
  const venues = useVenues();
  const areas = venues.data ? [...new Set(venues.data.map((v) => v.area))].sort((a, b) => a.localeCompare(b)) : [];
  return { ...venues, areas };
}
