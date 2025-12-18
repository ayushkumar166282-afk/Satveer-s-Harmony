
import { Song } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'Attention',
    artist: 'Charlie Puth',
    album: 'Voicenotes',
    cover: 'https://picsum.photos/seed/attention/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 208,
    lyrics: "You just want attention, you don't want my heart. Maybe you just hate the thought of me with someone new."
  },
  {
    id: '2',
    title: 'Stay',
    artist: 'Justin Bieber',
    album: 'F*CK LOVE 3',
    cover: 'https://picsum.photos/seed/stay/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 141,
    lyrics: "I get drunk, wake up, I'm wasted still. I realize the time that I wasted here."
  },
  {
    id: '3',
    title: 'Rockstar',
    artist: 'Ilkay Sencan',
    album: 'Rockstar Single',
    cover: 'https://picsum.photos/seed/rockstar/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration: 180
  },
  {
    id: '4',
    title: 'Starlit Reverie',
    artist: 'Budiarti',
    album: 'Night Sessions',
    cover: 'https://picsum.photos/seed/starlit/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration: 240
  },
  {
    id: '5',
    title: 'Midnight Confessions',
    artist: 'Deeper Blue',
    album: 'Urban Nights',
    cover: 'https://picsum.photos/seed/midnight/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration: 195
  }
];

export const CATEGORIES = ['All', 'New Release', 'Trending', 'Top'];

export const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop";
