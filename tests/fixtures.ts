import type { GitHubProfile } from '../src/types';
export const torvalds: GitHubProfile = {
  id: 1024025, login: 'torvalds', avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
  html_url: 'https://github.com/torvalds', type: 'User', name: 'Linus Torvalds',
  bio: 'Linux', location: 'Portland, OR', company: null, public_repos: 8, followers: 100,
};
export const searchResult = { total_count: 1, incomplete_results: false, items: [torvalds] };
