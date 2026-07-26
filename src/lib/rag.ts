import { createClient } from "@supabase/supabase-js";

const HF_EMBED_URL = process.env.HF_EMBED_URL || "";
const HF_EMBED_API_KEY = process.env.HF_EMBED_API_KEY || "";
// HF Space가 private이라 자체 EMBED_API_KEY와 별개로 HF 계정 토큰이 필요하다.
const HF_TOKEN = process.env.HF_TOKEN || "";
// 무료 티어 Space는 슬립 후 콜드스타트가 수십 초~수 분 걸릴 수 있다.
// 해몽 응답 전체가 그만큼 멈추지 않도록 짧게 끊고 fail-soft로 넘어간다.
const EMBED_TIMEOUT_MS = 8000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export type DreamSymbolMatch = {
  id: number;
  category: string | null;
  source_zh: string | null;
  interpretation_ko: string;
  similarity: number;
};

export async function embedText(text: string): Promise<number[] | null> {
  if (!HF_EMBED_URL) return null;

  try {
    const res = await fetch(`${HF_EMBED_URL}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HF_EMBED_API_KEY,
        ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
      },
      body: JSON.stringify({ texts: [text] }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("HF embed API error:", res.status);
      return null;
    }
    const data = await res.json();
    return data.embeddings?.[0] ?? null;
  } catch (error) {
    console.error("HF embed request failed:", error);
    return null;
  }
}

export async function retrieveDreamSymbols(
  dream: string,
  matchCount = 5,
): Promise<DreamSymbolMatch[]> {
  if (!supabase) return [];

  const embedding = await embedText(dream);
  if (!embedding) return [];

  try {
    const { data, error } = await supabase.rpc("match_dream_symbols", {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (error) {
      console.error("match_dream_symbols RPC error:", error);
      return [];
    }
    console.log("[RAG] top-k matches:", JSON.stringify(data, null, 2));
    return (data as DreamSymbolMatch[]) ?? [];
  } catch (error) {
    console.error("retrieveDreamSymbols failed:", error);
    return [];
  }
}
