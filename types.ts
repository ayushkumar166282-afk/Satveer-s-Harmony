
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  duration: number;
  lyrics?: string;
  isLocal?: boolean;
}

export enum Tab {
  Home = 'Home',
  Playlists = 'Playlists',
  Search = 'Search',
  Settings = 'Settings'
}

export type MusicQuality = 'Low' | 'Medium' | 'High';

export interface UserProfile {
  name: string;
  photo: string;
}
