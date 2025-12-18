
import { GoogleGenAI, Type } from "@google/genai";
import { Song } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchLyrics = async (title: string, artist: string): Promise<string> => {
  try {
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
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', // Mock URL
      album: 'Online Discovery',
      isLocal: false
    }));
  } catch (error) {
    console.error("Online search failed:", error);
    return [];
  }
};

/**
 * Fetches a real playable audio stream URL for a YouTube video ID.
 * Uses a public Piped API instance as a proxy.
 */
export const getYoutubeStreamUrl = async (videoId: string): Promise<string | null> => {
  try {
    // Using a public Piped instance to get streamable URLs
    const response = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
    const data = await response.json();
    
    if (data.audioStreams && data.audioStreams.length > 0) {
      // Return the best audio stream URL
      return data.audioStreams[0].url;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch YouTube stream URL:", error);
    return null;
  }
};

/**
 * Direct search via YouTube Data API v3
 */
export const searchYouTube = async (query: string, apiKey: string): Promise<Song[]> => {
  if (!apiKey) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' song')}&type=video&maxResults=8&key=${apiKey}`
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
      cover: item.snippet.thumbnails.high.url,
      // Initial URL is a placeholder; it will be resolved to a real stream on play
      url: 'PENDING_YT_STREAM', 
      duration: 210,
      isLocal: false
    }));
  } catch (error) {
    console.error("YouTube Search failed:", error);
    return [];
  }
};
