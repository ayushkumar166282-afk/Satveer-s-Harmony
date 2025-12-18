
import { GoogleGenAI, Type } from "@google/genai";
import { Song } from "./types";

/**
 * Robustly initialize AI instance only when needed
 */
const getAI = () => {
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const fetchLyrics = async (title: string, artist: string): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide 4 lines of lyrics for the song "${title}" by "${artist}". Format as plain text.`,
    });
    return response.text || "Lyrics not available.";
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    return "Could not load lyrics.";
  }
};

export const searchOnlineSongs = async (query: string): Promise<Song[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for high-quality music metadata matching query: "${query}". Return as a JSON list of objects with title, artist, and duration (seconds).`,
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
            propertyOrdering: ["title", "artist", "duration"],
          },
        },
      },
    });
    const results = JSON.parse(response.text || "[]");
    return results.map((r: any, idx: number) => ({
      ...r,
      id: `online-${idx}-${Date.now()}`,
      cover: `https://picsum.photos/seed/${encodeURIComponent(r.title)}/400/400`,
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      album: 'Online Discovery',
      isLocal: false
    }));
  } catch (error) {
    console.error("Online search failed:", error);
    return [];
  }
};

/**
 * Resolves a YouTube video ID to a streamable audio URL using a public Piped proxy.
 */
export const getYoutubeStreamUrl = async (videoId: string): Promise<string | null> => {
  try {
    // Fallback list of public Piped instances if one fails
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.victr.me',
      'https://pipedapi.leptons.xyz'
    ];
    
    for (const instance of instances) {
      try {
        const response = await fetch(`${instance}/streams/${videoId}`);
        if (!response.ok) continue;
        const data = await response.json();
        
        if (data.audioStreams && data.audioStreams.length > 0) {
          // Find a reliable audio stream (M4A or Opus preferred for browser compatibility)
          const stream = data.audioStreams.find((s: any) => s.mimeType.includes('audio')) || data.audioStreams[0];
          return stream.url;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch YouTube stream URL:", error);
    return null;
  }
};

/**
 * Searches YouTube for video metadata using the provided API Key.
 */
export const searchYouTube = async (query: string, apiKey: string): Promise<Song[]> => {
  if (!apiKey) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      console.error("YouTube API Error:", data.error.message);
      return [];
    }

    return (data.items || []).map((item: any) => ({
      id: `yt-${item.id.videoId}`,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      album: 'YouTube Music',
      cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      url: 'PENDING_YT_STREAM', 
      duration: 0,
      isLocal: false
    }));
  } catch (error) {
    console.error("YouTube Search failed:", error);
    return [];
  }
};
