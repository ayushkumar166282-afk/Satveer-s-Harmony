
import React, { useState, useEffect, useRef } from 'react';
import { Home, ListMusic, Search, Settings, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Download, MoreVertical, X, Mic2, Volume2, Bluetooth, Youtube } from 'lucide-react';
import { Song, Tab, MusicQuality, UserProfile } from './types';
import { MOCK_SONGS, CATEGORIES, BACKGROUND_IMAGE } from './constants';
import { searchOnlineSongs, fetchLyrics, searchYouTube, getYoutubeStreamUrl } from './geminiService';

const App: React.FC = () => {
  // Navigation & State
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Home);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song>(MOCK_SONGS[0]);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localSongs, setLocalSongs] = useState<Song[]>(MOCK_SONGS);
  
  // Search & Settings
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState<string>(localStorage.getItem('yt_api_key') || '');
  
  // Player Features
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState(false);
  const [quality, setQuality] = useState<MusicQuality>('High');
  // Fix: Added missing bluetoothDevice state
  const [bluetoothDevice, setBluetoothDevice] = useState<string | null>(null);
  
  // Ref for Audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync Media Session (Lock Screen Controls)
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
        artwork: [{ src: currentSong.cover, sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentSong]);

  /**
   * Core Playback Logic
   * Handles stream resolution for YouTube songs and syncing the audio element.
   */
  useEffect(() => {
    let cancelled = false;

    const syncPlayback = async () => {
      if (!audioRef.current) return;

      // Check if we need to resolve a YouTube stream
      if (currentSong.id.startsWith('yt-') && currentSong.url === 'PENDING_YT_STREAM') {
        setIsBuffering(true);
        const videoId = currentSong.id.replace('yt-', '');
        const resolvedUrl = await getYoutubeStreamUrl(videoId);
        
        if (cancelled) return;
        setIsBuffering(false);

        if (resolvedUrl) {
          // Update the song object with real URL. This triggers the effect again.
          setCurrentSong(prev => ({ ...prev, url: resolvedUrl }));
          return;
        } else {
          alert("Could not load YouTube audio stream. Please try another track.");
          setIsPlaying(false);
          return;
        }
      }

      // Final Play/Pause sync
      if (isPlaying) {
        // Only try to play if we have a valid playable URL
        if (currentSong.url && currentSong.url !== 'PENDING_YT_STREAM') {
          audioRef.current.play().catch(err => {
            console.warn("Autoplay/Play prevented:", err);
            setIsPlaying(false);
          });
        }
      } else {
        audioRef.current.pause();
      }
    };

    syncPlayback();
    return () => { cancelled = true; };
  }, [isPlaying, currentSong.id, currentSong.url]);

  // Fetch Lyrics when requested
  useEffect(() => {
    if (showLyrics && currentSong) {
      setLyrics("Loading lyrics...");
      fetchLyrics(currentSong.title, currentSong.artist).then(setLyrics);
    }
  }, [showLyrics, currentSong.id]);

  const handleProgressUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
      setProgress(val);
    }
  };

  const handleNext = () => {
    const index = localSongs.findIndex(s => s.id === currentSong.id);
    const nextSong = localSongs[(index + 1) % localSongs.length];
    setCurrentSong(nextSong);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const index = localSongs.findIndex(s => s.id === currentSong.id);
    const prevSong = localSongs[(index - 1 + localSongs.length) % localSongs.length];
    setCurrentSong(prevSong);
    setIsPlaying(true);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    if (youtubeApiKey) {
      const results = await searchYouTube(searchQuery, youtubeApiKey);
      setSearchResults(results);
    } else {
      const results = await searchOnlineSongs(searchQuery);
      setSearchResults(results);
    }
    setIsSearching(false);
  };

  const saveYoutubeKey = (key: string) => {
    setYoutubeApiKey(key);
    localStorage.setItem('yt_api_key', key);
  };

  const importFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Fix: Explicitly typed 'file' as File to resolve unknown type errors on lines 158 and 162
      const newSongs: Song[] = Array.from(files).map((file: File, idx) => ({
        id: `local-${Date.now()}-${idx}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Imported Artist",
        album: "Local Upload",
        cover: `https://picsum.photos/seed/${idx}/400/400`,
        url: URL.createObjectURL(file),
        duration: 0,
        isLocal: true
      }));
      setLocalSongs(prev => [...newSongs, ...prev]);
    }
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col text-white">
      {/* Invisible Audio Engine */}
      <audio 
        ref={audioRef} 
        src={currentSong.url === 'PENDING_YT_STREAM' ? '' : currentSong.url} 
        onTimeUpdate={handleProgressUpdate} 
        onEnded={handleNext}
      />

      {/* Dynamic Immersive Background */}
      <div 
        className="fixed inset-0 z-0 transition-opacity duration-700"
        style={{ 
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: isPlayerOpen ? 0.3 : 0.08
        }}
      />

      {/* Main UI Layer */}
      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto pb-32 no-scrollbar">
        
        {/* TAB: HOME */}
        {currentTab === Tab.Home && (
          <div className="p-6 animate-fade-in">
            <header className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <img src="https://picsum.photos/seed/satveer/200/200" className="w-12 h-12 rounded-full border-2 border-white/20" />
                <h1 className="text-3xl font-bold">Harmony</h1>
              </div>
              <button className="p-3 glass rounded-full" onClick={() => setCurrentTab(Tab.Search)}><Search size={20} /></button>
            </header>

            <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button key={cat} className={`px-6 py-2 rounded-full font-medium transition whitespace-nowrap ${cat === 'All' ? 'bg-[#D6F044] text-black' : 'glass text-gray-400'}`}>
                  {cat}
                </button>
              ))}
            </div>

            <section className="mb-10">
              <h2 className="text-xl font-bold mb-4">Curated for you</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                <div className="min-w-[280px] h-44 bg-indigo-500/40 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group glass">
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold">Chill Vibes</h3>
                    <p className="text-sm opacity-70">Smooth morning instrumentals.</p>
                  </div>
                  <button onClick={() => { setCurrentSong(MOCK_SONGS[0]); setIsPlaying(true); }} className="relative z-10 bg-white text-black p-3 w-12 h-12 rounded-full shadow-lg">
                    <Play size={24} fill="currentColor" />
                  </button>
                  <img src="https://picsum.photos/seed/chill/400/400" className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full opacity-40 group-hover:scale-110 transition" />
                </div>
                
                <div className="min-w-[280px] h-44 bg-lime-500/40 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group glass">
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold">Top Hits</h3>
                    <p className="text-sm opacity-70">Chart topping melodies.</p>
                  </div>
                  <button onClick={() => { setCurrentSong(MOCK_SONGS[1]); setIsPlaying(true); }} className="relative z-10 bg-white text-black p-3 w-12 h-12 rounded-full shadow-lg">
                    <Play size={24} fill="currentColor" />
                  </button>
                  <img src="https://picsum.photos/seed/hits/400/400" className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full opacity-40 group-hover:scale-110 transition" />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Daily tracks</h2>
              <div className="space-y-4">
                {localSongs.slice(0, 5).map(song => (
                  <div key={song.id} className="flex items-center p-2 rounded-2xl hover:bg-white/5 cursor-pointer group" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden mr-4">
                      <img src={song.cover} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <Play size={18} fill="currentColor" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold truncate">{song.title}</h4>
                      <p className="text-xs text-gray-400">{song.artist}</p>
                    </div>
                    <button className="p-2 text-gray-500"><MoreVertical size={20} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB: SEARCH (YouTube Integrated) */}
        {currentTab === Tab.Search && (
          <div className="p-6 animate-fade-in">
            <h1 className="text-3xl font-bold mb-8">Search</h1>
            <form onSubmit={handleSearch} className="relative mb-8 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Songs, artists, or YouTube link" 
                  className="w-full glass py-4 pl-12 pr-6 rounded-2xl outline-none focus:ring-2 ring-lime-400 transition"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearching}
                className="px-6 py-4 glass rounded-2xl flex items-center gap-2 hover:bg-white/10 active:scale-95 transition"
              >
                {youtubeApiKey ? <Youtube size={20} className="text-red-500" /> : <Search size={20} />}
                <span className="font-bold">GO</span>
              </button>
            </form>

            <div className="space-y-4">
              {isSearching ? (
                <p className="text-center text-gray-500 animate-pulse mt-10">Searching the global cloud...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map(song => (
                  <div key={song.id} className="flex items-center p-3 glass rounded-2xl hover:bg-white/10 cursor-pointer animate-slide-up" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                    <img src={song.cover} className="w-14 h-14 rounded-xl object-cover mr-4" />
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold truncate">{song.title}</h4>
                      <p className="text-xs text-gray-400 truncate">
                        {song.artist} {song.id.startsWith('yt-') && <span className="bg-red-600 text-[8px] font-bold px-1.5 py-0.5 rounded ml-1">YT</span>}
                      </p>
                    </div>
                    <Play size={20} className="text-lime-400" fill="currentColor" />
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 mt-20 opacity-30">
                  <Youtube size={64} className="mx-auto mb-4" />
                  <p>Search YouTube or enter a key in Settings</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: LIBRARY (Playlists) */}
        {currentTab === Tab.Playlists && (
          <div className="p-6 animate-fade-in">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Library</h1>
              <label className="p-3 glass rounded-full cursor-pointer hover:bg-white/10 active:scale-95 transition">
                <Download size={20} />
                <input type="file" multiple accept="audio/*" className="hidden" onChange={importFiles} />
              </label>
            </header>
            
            <div className="space-y-4">
              {localSongs.map(song => (
                <div key={song.id} className="flex items-center p-2 rounded-2xl hover:bg-white/5 cursor-pointer" onClick={() => { setCurrentSong(song); setIsPlaying(true); }}>
                  <img src={song.cover} className="w-12 h-12 rounded-xl object-cover mr-4" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{song.title}</h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{song.album}</p>
                  </div>
                  <MoreVertical size={18} className="text-gray-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {currentTab === Tab.Settings && (
          <div className="p-6 animate-fade-in">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>
            
            <div className="glass rounded-3xl p-6 space-y-8">
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Youtube size={16} className="text-red-500" />
                  YouTube Integration
                </h3>
                <input 
                  type="password" 
                  placeholder="Paste YouTube API Key" 
                  className="w-full glass py-3 px-4 rounded-xl outline-none focus:ring-2 ring-red-500 transition text-sm"
                  value={youtubeApiKey}
                  onChange={(e) => saveYoutubeKey(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-2">Required for high-speed YouTube data fetching.</p>
              </section>

              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Audio Quality</h3>
                <div className="flex gap-2">
                  {['Low', 'Med', 'High'].map(q => (
                    <button 
                      key={q} 
                      onClick={() => setQuality(q as MusicQuality)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${quality === q ? 'bg-lime-400 text-black' : 'glass text-gray-400'}`}
                    >
                      {q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </section>

              <button className="w-full py-4 glass text-red-500 font-bold rounded-2xl hover:bg-red-500/10 active:scale-95 transition">
                RESET APP
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FULL PLAYER OVERLAY */}
      <div 
        className={`fixed inset-0 z-50 glass-dark transform transition-all duration-500 ease-in-out flex flex-col ${isPlayerOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      >
        <header className="p-6 flex justify-between items-center">
          <button onClick={() => setIsPlayerOpen(false)} className="p-2 glass rounded-full hover:bg-white/10 transition"><X size={20} /></button>
          <div className="text-center flex-1 mx-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">Playing From {currentSong.album}</p>
          </div>
          <button className="p-2 glass rounded-full hover:bg-white/10 transition"><MoreVertical size={20} /></button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto w-full">
          {/* Cover Art */}
          <div className="relative mb-12 w-full aspect-square max-w-[320px]">
            <div className={`w-full h-full rounded-[40px] overflow-hidden border-4 border-white/5 shadow-2xl relative z-10 transition-transform duration-1000 ${isPlaying ? 'scale-105' : 'scale-95'}`}>
              <img src={currentSong.cover} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
            {/* Visualizer/Glow Effect */}
            <div className="absolute inset-0 bg-white/20 blur-[80px] rounded-full -z-10 animate-pulse" />
            
            {isBuffering && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-[40px] backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Song Info */}
          <div className="w-full text-center mb-10">
            <h2 className="text-3xl font-bold mb-2 tracking-tight text-shadow">{currentSong.title}</h2>
            <p className="text-lg text-gray-400 font-medium">{currentSong.artist}</p>
          </div>

          {/* Progress Slider */}
          <div className="w-full mb-10 px-2">
            <input 
              type="range" 
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-lime-400 transition" 
              value={progress}
              onChange={handleSeek}
            />
            <div className="flex justify-between text-[10px] font-black text-gray-500 tracking-[0.2em] mt-3 uppercase">
              <span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{(Math.floor((audioRef.current?.currentTime || 0) % 60)).toString().padStart(2, '0')}</span>
              <span>{Math.floor((audioRef.current?.duration || 0) / 60)}:{(Math.floor((audioRef.current?.duration || 0) % 60)).toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-10 mb-12">
            <button className="text-gray-400 hover:text-white transition active:scale-90"><Shuffle size={24} /></button>
            <button className="text-white hover:text-lime-400 active:scale-75 transition" onClick={handlePrev}><SkipBack size={36} fill="currentColor" /></button>
            <button 
              className="w-20 h-20 bg-[#D6F044] text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition transform-gpu"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
            </button>
            <button className="text-white hover:text-lime-400 active:scale-75 transition" onClick={handleNext}><SkipForward size={36} fill="currentColor" /></button>
            <button className="text-gray-400 hover:text-white transition active:scale-90"><Repeat size={24} /></button>
          </div>

          {/* Lyrics / Meta Toggle */}
          <div className="w-full glass rounded-[32px] p-6 mb-4 min-h-[140px] flex flex-col items-center justify-center">
            <button onClick={() => setShowLyrics(!showLyrics)} className="text-[10px] font-bold text-lime-400 uppercase tracking-widest mb-4 hover:opacity-80 transition">
              {showLyrics ? 'HIDE LYRICS' : 'VIEW LYRICS'}
            </button>
            
            <div className="w-full h-full overflow-y-auto no-scrollbar text-center px-4">
              {showLyrics ? (
                 <p className="italic text-sm text-gray-300 leading-relaxed animate-fade-in">
                    {lyrics}
                 </p>
              ) : (
                <div className="text-[10px] text-gray-500 font-medium tracking-wide">
                  Bitrate: {quality === 'High' ? '320kbps' : quality === 'Medium' ? '192kbps' : '128kbps'} • Audio Engine v2.0
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="p-8 border-t border-white/5 flex justify-between items-center max-w-xl mx-auto w-full">
          {/* Fix: Resolved missing setBluetoothDevice and bluetoothDevice references */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setBluetoothDevice(prev => prev ? null : "JBL Pulse 5")}>
            <div className={`p-2 rounded-full transition ${bluetoothDevice ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
              <Bluetooth size={20} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest">
              <p className="text-gray-500 text-[8px]">Device Output</p>
              <p className={bluetoothDevice ? 'text-blue-400' : 'text-gray-300'}>{bluetoothDevice || "Phone Speaker"}</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button className="p-2 glass rounded-full hover:text-lime-400 transition"><Volume2 size={20} /></button>
             <button className="p-2 glass rounded-full hover:text-lime-400 transition"><Mic2 size={20} /></button>
          </div>
        </footer>
      </div>

      {/* MINI PLAYER (Visible when overlay is closed) */}
      {!isPlayerOpen && (
        <div 
          className="fixed bottom-28 left-6 right-6 z-40 glass rounded-3xl p-3 flex items-center shadow-2xl cursor-pointer hover:bg-white/10 transition group border border-white/10 animate-slide-up"
          onClick={() => setIsPlayerOpen(true)}
        >
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg mr-4">
            <img src={currentSong.cover} className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${isPlaying ? 'scale-150 rotate-12' : ''}`} />
            {isBuffering && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="font-bold text-sm truncate">{currentSong.title}</h4>
            <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
          </div>
          <div className="flex gap-2 px-2">
            <button className="p-2 hover:bg-white/10 rounded-full transition active:scale-90" onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}>
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full transition active:scale-90" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
              <SkipForward size={22} fill="currentColor" />
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION BAR */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-8 py-3 flex items-center gap-10 shadow-2xl border border-white/10">
        {[
          { id: Tab.Home, icon: Home },
          { id: Tab.Playlists, icon: ListMusic },
          { id: Tab.Search, icon: Search },
          { id: Tab.Settings, icon: Settings }
        ].map(item => (
          <button 
            key={item.id} 
            className={`p-2 rounded-full transition-all duration-300 active:scale-90 ${currentTab === item.id ? 'bg-[#D6F044] text-black shadow-[0_0_20px_rgba(214,240,68,0.3)] scale-110' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setCurrentTab(item.id)}
          >
            <item.icon size={24} strokeWidth={currentTab === item.id ? 2.5 : 2} />
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
