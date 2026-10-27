import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as volunteerApi from '../api/volunteer';
import { useToast } from '../components/ui';
import { getErrorMessage } from '../utils/apiError';

export const volunteerKeys = {
  all: ['volunteer'],
  opportunities: (filters) => ['volunteer', 'opportunities', filters],
  roles: (eventId) => ['volunteer', 'roles', eventId],
  applications: (eventId) => ['volunteer', 'applications', eventId],
};

const PAGE_SIZE = 10;

// filters from useEventFilters; `free` doesn't apply to volunteering.
export function useOpportunities({ free: _free, ...filters }) {
  return useQuery({
    queryKey: volunteerKeys.opportunities(filters),
    queryFn: () => volunteerApi.listOpportunities({ ...filters, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useEventRoles(eventId) {
  return useQuery({
    queryKey: volunteerKeys.roles(eventId),
    queryFn: () => volunteerApi.getEventRoles(eventId),
    enabled: Boolean(eventId),
  });
}

// Patch one role everywhere it's cached (opportunity pages + event role
// lists), so the UI updates in place without a refetch flicker.
function patchRoleInCaches(queryClient, roleId, patch) {
  queryClient.setQueriesData({ queryKey: ['volunteer', 'opportunities'] }, (page) =>
    page && {
      ...page,
      data: page.data.map((event) => ({
        ...event,
        roles: event.roles.map((role) => (role.id === roleId ? { ...role, ...patch(role) } : role)),
      })),
    }
  );
  queryClient.setQueriesData({ queryKey: ['volunteer', 'roles'] }, (roles) =>
    roles?.map((role) => (role.id === roleId ? { ...role, ...patch(role) } : role))
  );
}

export function useApply() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ roleId, answers }) => volunteerApi.applyToRole(roleId, answers),
    onSuccess: (application, { roleId }) => {
      patchRoleInCaches(queryClient, roleId, () => ({ myStatus: application.status }));
      toast.show('Application sent! The organizer will review it soon.', 'success');
    },
    // Re-sync in the background (spots may have changed meanwhile).
    onSettled: () => queryClient.invalidateQueries({ queryKey: volunteerKeys.all }),
  });
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ roleId }) => volunteerApi.withdrawFromRole(roleId),
    onSuccess: (_data, { roleId }) => {
      patchRoleInCaches(queryClient, roleId, (role) => ({
        myStatus: null,
        ...(role.myStatus === 'accepted' && { spotsLeft: role.spotsLeft + 1 }),
      }));
      toast.show('Your application was withdrawn.', 'success');
    },
    onError: (error) => toast.show(getErrorMessage(error), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: volunteerKeys.all }),
  });
}

// ---- organizer

export function useApplications(eventId) {
  return useQuery({
    queryKey: volunteerKeys.applications(eventId),
    queryFn: () => volunteerApi.getApplications(eventId),
    enabled: Boolean(eventId),
  });
}

function useInvalidateVolunteer() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: volunteerKeys.all });
}

export function useCreateRole(eventId) {
  const invalidate = useInvalidateVolunteer();
  return useMutation({ mutationFn: (role) => volunteerApi.createRole(eventId, role), onSuccess: invalidate });
}

export function useUpdateRole() {
  const invalidate = useInvalidateVolunteer();
  return useMutation({ mutationFn: ({ roleId, changes }) => volunteerApi.updateRole(roleId, changes), onSuccess: invalidate });
}

export function useDeleteRole() {
  const invalidate = useInvalidateVolunteer();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ roleId }) => volunteerApi.deleteRole(roleId),
    onSuccess: invalidate,
    onError: (error) => toast.show(getErrorMessage(error), 'error'),
  });
}

export function useSetApplicationStatus(eventId) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ applicationId, status }) => volunteerApi.setApplicationStatus(applicationId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: volunteerKeys.applications(eventId) }),
    onError: (error) => toast.show(getErrorMessage(error), 'error'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: volunteerKeys.all }),
  });
}
