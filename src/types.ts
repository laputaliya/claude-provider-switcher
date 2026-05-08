export interface Profile {
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
}

export interface ProfilesConfig {
  profiles: Profile[];
  active: string | null;
}
