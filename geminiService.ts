
import { GoogleGenAI, Type } from "@google/genai";
import { Song } from "./types";

/**
 * Helper to get streamable audio URL from a YouTube Video ID using multiple proxy instances.
 */
export const getYoutubeStreamUrl = async (videoId: string): Promise<string | null> => {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.victr.me',
    'https://pipedapi.leptons.xyz',
    'https://piped-api.lunar.icu',
    'https://yt.artemislena.eu'
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`);
      if (!response.ok) continue;
      const data = await response.json();
      
      if (data.audioStreams && data.audioStreams.length > 0) {
        // Prefer opus or m4a if possible, otherwise first available
        const stream = data.audioStreams.find((s: any) => s.mimeType.includes('audio/webm') || s.mimeType.includes('audio/mp4')) || data.audioStreams[0];
        return stream.url;
      }
    } catch (e) {
      console.warn(`Proxy ${instance} failed, trying next...`);
      continue;
    }
  }
  return null;
};

/**
 * Strictly follow @google/genai guidelines for AI service.
 */
export const fetchLyrics = async (title: string, artist: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide exactly 4 lines of lyrics for the song "${title}" by "${artist}". Output as plain text without any intro or outro.`,
    });
    return response.text || "Lyrics not found.";
  } catch (error) {
    console.error("fetchLyrics error:", error);
    return "Lyrics unavailable.";
  }
};

export const searchOnlineSongs = async (query: string): Promise<Song[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for high-quality music metadata for: "${query}". Return as a JSON array of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              artist: { type: Type.STRING },
              duration: { type: Type.NUMBER },
            },
            required: ["title", "artist", "duration"],
          },
        },
      },
    });
    
    const results = JSON.parse(response.text || "[]");
    return results.map((r: any, idx: number) => ({
      ...r,
      id: `online-${idx}-${Date.now()}`,
      cover: `https://picsum.photos/seed/${encodeURIComponent(r.title)}/400/400`,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', // Generic fallback
      album: 'Web Result',
      isLocal: false
    }));
  } catch (error) {
    console.error("searchOnlineSongs error:", error);
    return [];
  }
};

export const searchYouTube = async (query: string, apiKey: string): Promise<Song[]> => {
  if (!apiKey) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' music video')}&type=video&maxResults=10&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      console.error("YouTube Search Error:", data.error.message);
      return [];
    }

    return (data.items || []).map((item: any) => ({
      id: `yt-${item.id.videoId}`,
      title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      artist: item.snippet.channelTitle,
      album: 'YouTube',
      cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      url: 'PENDING_YT_STREAM', 
      duration: 0,
      isLocal: false
    }));
  } catch (error) {
    console.error("YouTube API failed:", error);
    return [];
  }
};
