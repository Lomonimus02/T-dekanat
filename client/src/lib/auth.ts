import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Me = { id: string; role: 'student' | 'staff'; name: string; login: string };
export const useMe = () => useQuery<Me>({ queryKey: ['me'], queryFn: () => api('/auth/me'), retry: false, staleTime: 60_000 });
