import { api } from './client';

export interface ParentalControls {
  useChannelAllowlist: boolean;
  allowedChannels: string[];
  blockedCategories: string[];
  blockedVideos: string[];
  contentFilters: {
    kolIsha: boolean;
    womenOnly: boolean;
  };
  ageRating: string | null;
  watchTime: {
    mode: 'UNIFORM' | 'PER_DAY';
    dailyLimitMinutes: number | null;
    perDayLimits: Record<string, number | null>;
    perChannelLimits: Record<string, number | null>;
  };
  watchWindows: {
    mode: 'UNIFORM' | 'PER_DAY';
    windows: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
  };
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  maturitySettings: string | null;
  isKidsProfile: boolean;
  pinHash?: string | null;
  isLocked: boolean;
  parentalControls: ParentalControls | null;
  createdAt: string;
  updatedAt: string;
}

export async function getProfiles(): Promise<Profile[]> {
  const response = await api.get('/profiles');
  return response.data.data ?? response.data;
}

export async function getProfile(profileId: string): Promise<Profile> {
  const response = await api.get(`/profiles/${profileId}`);
  return response.data.data ?? response.data;
}

export async function createProfile(data: Partial<Profile>): Promise<Profile> {
  const response = await api.post('/profiles', data);
  return response.data.data ?? response.data;
}

export async function updateProfile(profileId: string, data: Partial<Profile>): Promise<Profile> {
  const response = await api.patch(`/profiles/${profileId}`, data);
  return response.data.data ?? response.data;
}

export async function deleteProfile(profileId: string): Promise<void> {
  await api.delete(`/profiles/${profileId}`);
}

export async function setProfilePin(profileId: string, pin: string): Promise<void> {
  await api.post(`/profiles/${profileId}/pin`, { pin });
}

export async function verifyProfilePin(profileId: string, pin: string): Promise<void> {
  await api.post(`/profiles/${profileId}/pin/verify`, { pin });
}

export async function clearProfilePin(profileId: string): Promise<void> {
  await api.delete(`/profiles/${profileId}/pin`);
}

export async function updateParentalControls(
  profileId: string,
  parentalControls: ParentalControls
): Promise<Profile> {
  const response = await api.patch(`/profiles/${profileId}/parental-controls`, { parentalControls });
  return response.data.data ?? response.data;
}

export const defaultParentalControls: ParentalControls = {
  useChannelAllowlist: false,
  allowedChannels: [],
  blockedCategories: [],
  blockedVideos: [],
  contentFilters: {
    kolIsha: false,
    womenOnly: false,
  },
  ageRating: null,
  watchTime: {
    mode: 'UNIFORM',
    dailyLimitMinutes: null,
    perDayLimits: {},
    perChannelLimits: {},
  },
  watchWindows: {
    mode: 'UNIFORM',
    windows: [],
  },
};

export function getKidsDefaultParentalControls(): ParentalControls {
  return {
    ...defaultParentalControls,
    contentFilters: {
      kolIsha: true,
      womenOnly: false,
    },
    ageRating: 'G',
  };
}
