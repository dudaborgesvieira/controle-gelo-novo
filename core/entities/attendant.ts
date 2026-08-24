export interface Attendant {
  id: string;
  name: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string; // ISO format
}

export const DEFAULT_ATTENDANTS: Attendant[] = [
  {
    id: 'att-duda',
    name: 'Duda',
    avatarUrl: 'https://picsum.photos/seed/duda/100/100',
    isActive: true,
    createdAt: '2026-01-01T08:05:00Z',
  },
  {
    id: 'att-1',
    name: 'Danilo',
    avatarUrl: 'https://picsum.photos/seed/danilo/100/100',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'att-2',
    name: 'Roseli',
    avatarUrl: 'https://picsum.photos/seed/roseli/100/100',
    isActive: true,
    createdAt: '2026-01-15T11:00:00Z',
  },
  {
    id: 'att-3',
    name: 'Wagner',
    avatarUrl: 'https://picsum.photos/seed/wagner/100/100',
    isActive: true,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'att-4',
    name: 'Luciano',
    avatarUrl: 'https://picsum.photos/seed/luciano/100/100',
    isActive: true,
    createdAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 'att-5',
    name: 'Paulo Gabriel',
    avatarUrl: 'https://picsum.photos/seed/paulo/100/100',
    isActive: true,
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'att-6',
    name: 'Gleison',
    avatarUrl: 'https://picsum.photos/seed/gleison/100/100',
    isActive: true,
    createdAt: '2026-03-10T16:45:00Z',
  },
  {
    id: 'att-7',
    name: 'Marcos (Inativo)',
    avatarUrl: '',
    isActive: false,
    createdAt: '2025-12-01T10:00:00Z',
  }
];
