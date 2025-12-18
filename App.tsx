
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, ListMusic, Search, Settings, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Heart, Download, MoreVertical, X, Maximize2, Mic2, Volume2, Bluetooth, Youtube } from 'lucide-react';
import { Song, Tab, MusicQuality, UserProfile } from './types';
import { MOCK_SONGS, CATEGORIES, BACKGROUND_IMAGE } from './constants';
import { searchOnlineSongs, fetchLyrics, searchYouTube, getYoutubeStreamUrl } from './geminiService';

const App: React.FC = () => {
  // Global State
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Home);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song>(MOCK_SONGS[0]);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localSongs, setLocalSongs] = useState<Song[]>(MOCK_SONGS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [user, setUser] = useState<UserProfile>({
    name: "Satveer",
    photo: "https://picsum.photos/seed/satveer/200/200"
  });
  const [quality, setQuality] = useState<MusicQuality>('High');
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string>('');
  const [bluetoothDevice, setBluetoothDevice] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState<string>(localStorage.getItem('yt_api_key') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Media Session for background control
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
        artwork: [
          { src: currentSong.cover, sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentSong]);

  // Combined Effect for Playback and Stream Resolution
  useEffect(() => {
    const handlePlayback = async () => {
      // Resolve YouTube Stream if necessary
      if (currentSong.id.startsWith('yt-') && currentSong.url === 'PENDING_YT_STREAM') {
        setIsBuffering(true);
        const videoId = currentSong.id.replace('yt-', '');
        const realUrl = await getYoutubeStreamUrl(videoId);
        setIsBuffering(false);
        if (realUrl) {
          setCurrentSong(prev => ({ ...prev, url: realUrl }));
          return; // The next effect cycle will trigger play()
        }
      }

      if (isPlaying) {
        audioRef.current?.play().catch(() => {
          console.warn("Autoplay blocked or stream invalid. User interaction required.");
        });
        setShowNotification(true);
      } else {
        audioRef.current?.pause();
      }
    };

    handlePlayback();
  }, [isPlaying, currentSong]);

  useEffect(() => {
    if (showLyrics && currentSong) {
      setLyrics("Loading lyrics...");
      fetchLyrics(currentSong.title, currentSong.artist).then(setLyrics);
    }
  }, [showLyrics, currentSong]);

  const handleProgress = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = (p / 100) * audioRef.current.duration;
      setProgress(p);
    }
  };

  const handleNext = () => {
    const currentIndex = localSongs.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % localSongs.length;
    setCurrentSong(localSongs[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const currentIndex = localSongs.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + localSongs.length) % localSongs.length;
    setCurrentSong(localSongs[prevIndex]);
    setIsPlaying(true);
  };

  const toggleFavorite = (song: Song) => {
    const id = song.id;
    if (favorites.includes(id)) {
      setFavorites(prev => prev.filter(fid => fid !== id));
    } else {
      setFavorites(prev => [...prev, id]);
      if (!localSongs.some(s => s.id === id)) {
        setLocalSongs(prev => [song, ...prev]);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    const localMatches = localSongs.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    let finalResults = [...localMatches];

    if (youtubeApiKey) {
      const ytResults = await searchYouTube(searchQuery, youtubeApiKey);
      finalResults = [...finalResults, ...ytResults];
    } else {
      const onlineResults = await searchOnlineSongs(searchQuery);
      finalResults = [...finalResults, ...onlineResults];
    }

    const uniqueResults = Array.from(new Map(finalResults.map(s => [s.id, s])).values());
    setSearchResults(uniqueResults);
    setIsSearching(false);
  };

  const saveYoutubeKey = (key: string) => {
    setYoutubeApiKey(key);
    localStorage.setItem('yt_api_key', key);
  };

  const importSongs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newSongs: Song[] = Array.from(files).map((file: File, idx) => ({
        id: `local-${Date.now()}-${idx}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Imported Artist",
        album: "My Imports",
        cover: `https://picsum.photos/seed/${idx}/400/400`,
        url: URL.createObjectURL(file),
        duration: 0,
        isLocal: true
      }));
      setLocalSongs(prev => [...newSongs, ...prev]);
    }
  };

  const updateProfilePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUser(prev => ({ ...prev, photo: url }));
    }
  };

  const toggleBluetooth = () => {
    setBluetoothDevice(prev => prev ? null : "JBL Flip 6 (Connected)");
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col text-white">
      <audio 
        ref={audioRef} 
        src={currentSong.url} 
        onTimeUpdate={handleProgress} 
        onEnded={handleNext}
      />

      <div 
        className="fixed inset-0 z-0 transition-opacity duration-700"
        style={{ 
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: isPlayerOpen ? 0.4 : 0.1
        }}
      />

      {showNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-80 bg-white rounded-2xl shadow-2xl flex items-center p-3 animate-bounce-in text-black">
          <img src={currentSong.cover} className="w-12 h-12 rounded-full object-cover shadow-lg" />
          <div className="ml-3 flex-1 overflow-hidden">
            <h4 className="font-bold text-sm truncate">{currentSong.title}</h4>
            <p className="text-xs text-gray-500 truncate">{currentSong.artist}</p>
          </div>
          <div className="flex gap-2 text-gray-700">
            <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-black">
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button onClick={handleNext} className="hover:text-black"><SkipForward size={18} fill="currentColor" /></button>
            <button onClick={() => setShowNotification(false)} className="text-gray-400"><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto pb-24">
        {currentTab === Tab.Home && (
          <div className="p-6">
            <header className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={user.photo} className="w-12 h-12 rounded-full object-cover border-2 border-white/20" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-black rounded-full" />
                </div>
                <h1 className="text-3xl font-bold">Hi, {user.name}</h1>
              </div>
              <div className="flex gap-3">
                <button className="p-3 glass rounded-full" onClick={() => setCurrentTab(Tab.Search)}><Search size={20} /></button>
                <button className="p-3 glass rounded-full"><Heart size={20} /></button>
              </div>
            </header>

            <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button key={cat} className={`px-6 py-2 rounded-full font-medium transition ${cat === 'All' ? 'bg-[#D6F044] text-black' : 'glass text-gray-400'}`}>
                  {cat}
                </button>
              ))}
            </div>

            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4">Curated & trending</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                <div className="min-w-[300px] h-48 bg-purple-300 rounded-3xl p-6 flex flex-col justify-between text-black relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-2">Discover weekly</h3>
                    <p className="text-sm opacity-80 max-w-[150px]">The original slow instrumental best playlists.</p>
                  </div>
                  <div className="relative z-10 flex gap-4 items-center mt-4">
                    <button className="bg-black text-white p-3 rounded-full hover:scale-105 transition shadow-xl" onClick={() => { setCurrentSong(MOCK_SONGS[0]); setIsPlaying(true); }}>
                      <Play size={20} fill="currentColor" />
                    </button>
                    <Heart size={20} />
                    <Download size={20} />
                    <MoreVertical size={20} />
                  </div>
                  <img src="https://picsum.photos/seed/playlist1/300/300" className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full object-cover transform group-hover:scale-110 transition duration-500 opacity-90" />
                </div>
                
                <div className="min-w-[300px] h-48 bg-lime-300 rounded-3xl p-6 flex flex-col justify-between text-black relative overflow-hidden">
                   <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-2">Release Radar</h3>
                    <p className="text-sm opacity-80 max-w-[150px]">Fresh tunes from your favorite artists.</p>
                  </div>
                   <div className="relative z-10 flex gap-4 items-center">
                    <button className="bg-black text-white p-3 rounded-full"><Play size={20} fill="currentColor" /></button>
                    <Heart size={20} />
                    <MoreVertical size={20} />
                  </div>
                  <img src="https://picsum.photos/seed/playlist2/300/300" className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full object-cover opacity-90" />
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Top daily playlists</h2>
                <button className="text-sm text-gray-400 hover:text-white transition">See all</button>
              </div>
              <div className="space-y-4">
                {localSongs.slice(0, 4).map(song => (
                  <div key={song.id} className="flex items-center group cursor-pointer" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                      <img src={song.cover} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                         <Play size={20} fill="currentColor" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-bold">{song.title}</h4>
                      <p className="text-sm text-gray-400">By {song.artist} • {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</p>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-white"><MoreVertical size={20} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {currentTab === Tab.Playlists && (
          <div className="p-6">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Your Playlists</h1>
              <label className="flex items-center gap-2 glass px-4 py-2 rounded-full cursor-pointer hover:bg-white/10 transition">
                <Download size={18} />
                <span className="text-sm font-medium">Import Songs</span>
                <input type="file" multiple accept="audio/*" className="hidden" onChange={importSongs} />
              </label>
            </header>
            
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="h-40 glass rounded-3xl p-4 flex flex-col justify-end relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <img src="https://picsum.photos/seed/fav/300/300" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition" />
                <div className="relative z-20">
                  <h3 className="font-bold">Liked Songs</h3>
                  <p className="text-xs text-gray-400">{favorites.length} songs</p>
                </div>
              </div>
              <div className="h-40 glass rounded-3xl p-4 flex flex-col justify-end relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <img src="https://picsum.photos/seed/recent/300/300" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition" />
                <div className="relative z-20">
                  <h3 className="font-bold">Recently Played</h3>
                  <p className="text-xs text-gray-400">12 songs</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold mb-4">All Tracks</h2>
              {localSongs.map(song => (
                <div key={song.id} className="flex items-center p-2 rounded-2xl hover:bg-white/5 group" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                  <img src={song.cover} className="w-12 h-12 rounded-xl object-cover" />
                  <div className="ml-4 flex-1">
                    <h4 className="font-medium text-sm">{song.title}</h4>
                    <p className="text-xs text-gray-400">{song.artist}</p>
                  </div>
                  <button className={`p-2 transition ${favorites.includes(song.id) ? 'text-red-500' : 'text-gray-500 hover:text-white'}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}>
                    <Heart size={18} fill={favorites.includes(song.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === Tab.Search && (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-8">Search</h1>
            <form onSubmit={handleSearch} className="relative mb-8 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Artists, songs, or lyrics" 
                  className="w-full glass py-4 pl-12 pr-6 rounded-2xl outline-none focus:ring-2 ring-lime-400 transition"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearching}
                className={`px-6 py-4 glass rounded-2xl hover:bg-white/10 transition flex items-center gap-2 ${isSearching ? 'opacity-50' : ''}`}
              >
                {youtubeApiKey ? <Youtube size={20} className="text-red-500" /> : <Search size={20} />}
                <span className="font-bold text-sm">GO</span>
              </button>
            </form>

            <div className="space-y-6">
              {searchResults.length > 0 ? (
                <div>
                  <h2 className="text-lg font-bold mb-4">Results</h2>
                  {searchResults.map(song => (
                    <div key={song.id} className="flex items-center p-3 glass rounded-2xl mb-3 animate-slide-up hover:bg-white/5 cursor-pointer" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                      <img src={song.cover} className="w-14 h-14 rounded-xl object-cover" />
                      <div className="ml-4 flex-1">
                        <h4 className="font-bold truncate max-w-[180px]">{song.title}</h4>
                        <p className="text-sm text-gray-400 truncate max-w-[180px]">
                          {song.artist} 
                          {song.id.startsWith('yt-') && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded ml-1">YT</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          className={`p-3 rounded-full transition ${favorites.includes(song.id) ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-white'}`}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}
                        >
                          <Heart size={20} fill={favorites.includes(song.id) ? 'currentColor' : 'none'} />
                        </button>
                        <Play size={20} className="text-lime-400 mr-2" fill="currentColor" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {isSearching && <p className="text-center text-gray-500 animate-pulse">Searching the cosmos...</p>}
                  {!isSearching && (
                    <div>
                      <h2 className="text-lg font-bold mb-4">Top Genres</h2>
                      <div className="grid grid-cols-2 gap-4">
                        {['Pop', 'Lofi', 'Jazz', 'Electronic'].map((genre, i) => (
                          <div key={genre} className={`h-24 rounded-2xl p-4 flex items-center justify-center font-bold text-xl relative overflow-hidden cursor-pointer`}>
                            <img src={`https://picsum.photos/seed/genre${i}/300/300`} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                            <span className="relative z-10">{genre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {currentTab === Tab.Settings && (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>
            
            <div className="glass rounded-3xl p-6 mb-6">
              <div className="flex items-center gap-6 mb-6">
                <img src={user.photo} className="w-20 h-20 rounded-full object-cover border-4 border-white/10" />
                <div>
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <p className="text-gray-400 mb-2">satveer.harmony@music.com</p>
                  <label className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-200 transition">
                    CHANGE PHOTO
                    <input type="file" className="hidden" onChange={updateProfilePhoto} accept="image/*" />
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Youtube size={16} className="text-red-500" />
                    YouTube Integration
                  </h3>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Enter YouTube API Key" 
                      className="w-full glass py-3 px-4 rounded-xl outline-none focus:ring-2 ring-red-500 transition text-sm"
                      value={youtubeApiKey}
                      onChange={(e) => saveYoutubeKey(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">Allows searching real videos from YouTube.</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Music Quality</h3>
                  <div className="flex gap-2">
                    {['Low', 'Medium', 'High'].map(q => (
                      <button 
                        key={q} 
                        onClick={() => setQuality(q as MusicQuality)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${quality === q ? 'bg-lime-400 text-black' : 'glass text-gray-400'}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center py-4 border-t border-white/5">
                  <div>
                    <h3 className="font-bold">Offline Mode</h3>
                    <p className="text-xs text-gray-400">Save data by playing only local music</p>
                  </div>
                  <div className="w-12 h-6 bg-gray-800 rounded-full relative p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-gray-500 rounded-full" />
                  </div>
                </div>

                <div className="flex justify-between items-center py-4 border-t border-white/5">
                   <div>
                    <h3 className="font-bold">Storage</h3>
                    <p className="text-xs text-gray-400">2.4GB used of 128GB</p>
                  </div>
                  <button className="text-xs text-gray-400 border border-gray-700 px-3 py-1 rounded-full">MANAGE</button>
                </div>
              </div>
            </div>

            <button className="w-full py-4 glass text-red-400 font-bold rounded-2xl hover:bg-red-500/10 transition">
              LOG OUT
            </button>
          </div>
        )}
      </div>

      <div 
        className={`fixed inset-0 z-50 glass-dark transform transition-all duration-500 ease-out flex flex-col ${isPlayerOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      >
        <header className="p-6 flex justify-between items-center">
          <button onClick={() => setIsPlayerOpen(false)} className="p-2 glass rounded-full"><X size={20} /></button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">Now Playing</p>
            <h4 className="text-xs font-bold text-gray-300">{currentSong.album}</h4>
          </div>
          <button className="p-2 glass rounded-full"><MoreVertical size={20} /></button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative mb-12">
            <div className={`w-72 h-72 rounded-full overflow-hidden border-8 border-white/5 shadow-2xl relative z-10 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}>
              <img src={currentSong.cover} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <div className="absolute inset-0 w-72 h-72 bg-white/20 blur-[80px] rounded-full -z-10" />
            {isBuffering && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-full">
                <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="w-full text-center mb-10">
            <h2 className="text-3xl font-bold mb-2 text-shadow">{currentSong.title}</h2>
            <p className="text-lg text-gray-400">{currentSong.artist}</p>
          </div>

          <div className="w-full max-w-md px-4 mb-8">
            <input 
              type="range" 
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-lime-400 mb-2" 
              value={progress}
              onChange={handleSeek}
            />
            <div className="flex justify-between text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              <span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{(Math.floor((audioRef.current?.currentTime || 0) % 60)).toString().padStart(2, '0')}</span>
              <span>{Math.floor((audioRef.current?.duration || 0) / 60)}:{(Math.floor((audioRef.current?.duration || 0) % 60)).toString().padStart(2, '0')}</span>
            </div>
          </div>

          <div className="flex items-center gap-10 mb-12">
            <button className="text-gray-400 hover:text-white transition"><Shuffle size={24} /></button>
            <button className="text-white active:scale-90 transition" onClick={handlePrev}><SkipBack size={32} fill="currentColor" /></button>
            <button 
              className="w-20 h-20 bg-[#D6F044] text-black rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>
            <button className="text-white active:scale-90 transition" onClick={handleNext}><SkipForward size={32} fill="currentColor" /></button>
            <button className="text-gray-400 hover:text-white transition"><Repeat size={24} /></button>
          </div>

          <div className="w-full max-w-md glass rounded-3xl p-4 mb-8">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="font-bold text-sm">Up Next</h3>
              <button className="text-[10px] font-bold text-lime-400 uppercase tracking-wider" onClick={() => setShowLyrics(!showLyrics)}>
                {showLyrics ? 'Hide Lyrics' : 'View Lyrics'}
              </button>
            </div>
            
            {showLyrics ? (
               <div className="p-4 bg-black/40 rounded-2xl min-h-[150px] animate-fade-in overflow-y-auto max-h-40">
                  <p className="text-center italic text-gray-300 leading-relaxed font-medium">
                    "{lyrics}"
                  </p>
               </div>
            ) : (
              <div className="space-y-3 max-h-40 overflow-y-auto no-scrollbar">
                {localSongs.slice(1, 4).map(song => (
                  <div key={song.id} className="flex items-center p-2 rounded-2xl hover:bg-white/5 cursor-pointer" onClick={() => setCurrentSong(song)}>
                    <img src={song.cover} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="ml-3 flex-1">
                      <h4 className="text-sm font-bold truncate">{song.title}</h4>
                      <p className="text-[10px] text-gray-400">{song.artist}</p>
                    </div>
                    <Download size={16} className="text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="p-6 border-t border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={toggleBluetooth}>
            <div className={`p-2 rounded-full ${bluetoothDevice ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-400'} group-hover:scale-110 transition`}>
              <Bluetooth size={18} />
            </div>
            <div className="text-[10px] font-bold tracking-widest uppercase">
              <p className="text-gray-500">Output Device</p>
              <p className={bluetoothDevice ? 'text-blue-400' : 'text-gray-300'}>{bluetoothDevice || "Phone Speaker"}</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button className="p-2 glass rounded-full"><Mic2 size={18} /></button>
             <button className="p-2 glass rounded-full"><Volume2 size={18} /></button>
          </div>
        </footer>
      </div>

      {!isPlayerOpen && (
        <div 
          className="fixed bottom-24 left-6 right-6 z-40 glass rounded-3xl p-3 flex items-center shadow-2xl cursor-pointer hover:bg-white/10 transition group border border-white/10"
          onClick={() => setIsPlayerOpen(true)}
        >
          <img src={currentSong.cover} className={`w-14 h-14 rounded-2xl object-cover shadow-lg ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
          <div className="ml-4 flex-1 overflow-hidden">
            <h4 className="font-bold text-sm truncate">{currentSong.title}</h4>
            <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
          </div>
          <div className="flex gap-3 px-2">
            <button className="p-2 rounded-full hover:bg-white/20 transition" onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button className="p-2 rounded-full hover:bg-white/20 transition" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl border border-white/20">
        {[
          { id: Tab.Home, icon: Home },
          { id: Tab.Playlists, icon: ListMusic },
          { id: Tab.Search, icon: Search },
          { id: Tab.Settings, icon: Settings }
        ].map(item => (
          <button 
            key={item.id} 
            className={`p-2 rounded-full transition-all duration-300 ${currentTab === item.id ? 'bg-[#D6F044] text-black scale-110 shadow-lg' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setCurrentTab(item.id)}
          >
            <item.icon size={22} strokeWidth={currentTab === item.id ? 2.5 : 2} />
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
