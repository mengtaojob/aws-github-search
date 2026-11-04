export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface GitHubProfile extends GitHubUser {
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  public_repos: number;
  followers: number;
}

export interface SearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubUser[];
}

export interface SavedUser extends GitHubProfile {
  note: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UserPatch { note: string; tags: string[] }

export interface UserStore {
  list(): Promise<SavedUser[]>;
  add(profile: GitHubProfile): Promise<SavedUser | null>;
  update(id: number, patch: UserPatch): Promise<SavedUser | null>;
  remove(id: number): Promise<boolean>;
}
