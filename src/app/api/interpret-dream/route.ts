import { createClient } from "@supabase/supabase-js";
import { retrieveDreamSymbols } from "@/lib/rag";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-120b";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function callGroq(
  messages: { role: string; content: string }[],
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.8 }),
      });

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        const err = new Error("Too Many Requests");
        (err as { status?: number }).status = 429;
        throw err;
      }

      if (res.status === 503) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        const err = new Error("Service Unavailable");
        (err as { status?: number }).status = 503;
        throw err;
      }

      if (!res.ok) {
        throw new Error(`Groq API error: ${res.status}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      lastError = error;
      const msg = getErrorMessage(error);
      if (msg.includes("429") || msg.includes("503")) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  try {
    if (!GROQ_API_KEY) {
      return Response.json(
        { error: "API 키가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const { dream } = await request.json();

    if (!dream || !dream.trim()) {
      return Response.json(
        { error: "꿈의 내용을 입력해주세요." },
        { status: 400 },
      );
    }

    const dreamSymbolMatches = await retrieveDreamSymbols(dream);

    // 역할 정의
    const role = `You are a Korean dream interpretation expert.`;

    // 언어 출력 규칙 (순한글)
    const languageRule = `CRITICAL: Your entire response must be written in pure Korean Hangul (한글) only.
Do NOT use Chinese characters, Japanese characters, or English in the response content.`;

    // 해몽 방식
    const interpretationRule = `Interpret the user's dream by focusing only on what actually appears in the dream.
Do NOT invent or assume elements that are not in the dream description.
Briefly touch on the dreamer's current psychological state, but place greater emphasis on future predictions — what events, changes, or opportunities are coming, and when. Be specific and vivid about the future outlook.
FUTURE PREDICTION VARIETY: Do NOT default to work/career/"프로젝트" outcomes unless the dream itself clearly involves work. Draw future predictions from the full range of real life — 연애·인간관계, 건강, 재물·금전, 가족, 우연한 만남, 이사·여행, 학업, 일상의 변화 등. 
Choose the domain(s) that best fit the dream's actual symbols, and vary it across different dreams rather than defaulting to the same theme every time.
If the input does not appear to be a dream, refuse interpretation.
NAMED PEOPLE IN DREAMS: When a specific named person appears in the dream, always incorporate who they are into the interpretation. If they are a well-known public figure (celebrity, actor, singer, athlete, politician, etc.), 
consider what they are famous for and what qualities they represent (beauty, talent, charisma, success, power, popularity, etc.) — these qualities are what the dreamer's subconscious is drawing on. 
If you are unsure whether the person is famous, treat their name as a person and interpret based on the dreamer's interaction with them and the feelings the encounter evoked.
NATURAL KOREAN GRAMMAR: NEVER attach particles (는, 의, 가, 을, 이) directly to a verb's dictionary form ending in 다.
BAD: "날다는", "날다의", "날다가", "먹다는", "보다의"
GOOD: use the conjugated modifier form instead — "나는 것은", "나는 느낌은", "먹는 행위는", "바라보는 시선은"
When the dream action is a verb (e.g. 날다, 걷다, 먹다), always convert it to a noun phrase: 날다 → 나는 것 / 나는 행위, 걷다 → 걷는 것 / 걷는 모습.`;

    // 전통 해몽 참고자료 (RAG, 검색 결과가 있을 때만)
    const ragContext =
      dreamSymbolMatches.length > 0
        ? `전통 해몽 참고자료 (주공해몽 등 전통 문헌에서 검색된 것으로, 그대로 베끼지 말고 실제 꿈 내용과 맞는 것만 자연스럽게 녹여 활용하세요. 맞지 않으면 무시하세요):
${dreamSymbolMatches.map((m) => `- ${m.interpretation_ko}`).join("\n")}`
        : "";

    // 문체 스타일
    const styleRule = `LANGUAGE STYLE: Use plain, everyday Korean that anyone can understand without a dictionary.
Avoid formal academic terms, rare Sino-Korean words (한자어), or literary expressions.
Write conversationally, as if speaking warmly and directly to the dreamer.
ALL sentences across every field must consistently end with "~입니다" or "~합니다" without exception. Never use "~해요", "~네요", "~죠", or any other endings.`;

    // 키워드 볼드 처리 규칙
    const boldRule = `For important keywords that carry symbolic meaning, wrap them with ** like **단어** so they appear bold.
ONLY bold NOUNS or NOUN PHRASES (e.g. **하늘**, **불**, **어머니**, **강물**). NEVER bold a verb in dictionary form (e.g. do NOT write **날다**, **먹다**, **보다**). If the key symbol is an action, bold its noun equivalent instead (날다 → **비행**, 먹다 → **식사**, 걷다 → **발걸음**).`;

    // JSON 응답 형식
    const responseFormat = `Respond ONLY in the following JSON format. Do not include any text outside the JSON.

{
  "summary": "Start with '길몽' or '흉몽' or '평몽', then one-line core meaning (~25 Korean characters). Do NOT repeat the user's input.",
  "analysis": [
    "keyword item(s) FIRST: \"**단어**: 짧은 의미 (20-30 Korean characters)\" — one line per key symbol",
    "then paragraph item(s): \"단락 내용 (40-60 Korean characters). Bold key symbols with **단어**.\"",
    ...
  ],
  7-8 string items total, in this exact order:
  STEP 1 (keyword items, 2-3 items): Judge which symbolic elements in the dream are the MOST important (do not list every object — pick only the 2-3 that carry the strongest symbolic weight). For each, write ONE short line in the form "**단어**: 짧은 의미" giving just its core symbolic meaning, 20-30 Korean characters, no more.
  STEP 2 (paragraph items, 4-5 items): AFTER the keyword items, continue with full paragraphs (40-60 Korean characters each). First 1-2 paragraphs: deeper interpretation weaving the key symbols together with the dreamer's current psychological state. Remaining 2-3 paragraphs: focus on future predictions — what will happen, what changes are coming, and any specific advice. Each paragraph should feel like a fortune reading, not just symbolic analysis.
  "goodElements": "2 sentences: one about a fortunate sign in the dream, one about what good event or change it predicts for the dreamer's near future. Bold key nouns.",
  "badElements": "2 sentences: one about a cautionary sign in the dream, one about what risk or challenge it warns of ahead. Bold key nouns."
}

If not a dream: { "summary": "해몽할 수 없는 내용입니다.", "analysis": ["꿈의 내용이 아닌 것 같아 해몽을 드리기 어렵습니다."], "goodElements": "", "badElements": "" }`;

    const systemPrompt = [
      role,
      languageRule,
      interpretationRule,
      ragContext,
      styleRule,
      boldRule,
      responseFormat,
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `꿈: ${dream}` },
    ];

    const normalizeAnalysis = (raw: unknown): string[] => {
      if (Array.isArray(raw)) {
        return raw
          .map((item) =>
            typeof item === "string" ? item : (item?.content ?? ""),
          )
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      if (typeof raw === "string") {
        return raw
          .split("\n\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return [];
    };

    const parseResponse = (responseText: string) => {
      let parsed: {
        summary: string;
        analysis: unknown;
        goodElements: string;
        badElements: string;
      };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] || responseText);
      } catch {
        const lines = responseText.split("\n").filter((l) => l.trim());
        parsed = {
          summary: lines[0] || "",
          analysis: lines.slice(1),
          goodElements: "",
          badElements: "",
        };
      }
      return {
        summary: parsed.summary || "",
        analysis: normalizeAnalysis(parsed.analysis),
        goodElements: parsed.goodElements || "",
        badElements: parsed.badElements || "",
      };
    };

    let summary = "";
    let analysis: string[] = [];
    let goodElements = "";
    let badElements = "";

    for (let attempt = 0; attempt <= 1; attempt++) {
      const responseText = await callGroq(messages);
      const result = parseResponse(responseText);
      summary = result.summary;
      analysis = result.analysis;
      goodElements = result.goodElements;
      badElements = result.badElements;
      if (summary.trim() && analysis.length > 0) break;
    }

    if (!summary.trim() || analysis.length === 0) {
      return Response.json(
        { error: "해몽 결과를 생성하지 못했습니다. 다시 시도해 주세요." },
        { status: 500 },
      );
    }

    if (supabase) {
      const { error: insertError } = await supabase
        .from("data")
        .insert([{ description: "꿈 해석 결과", score: 0 }]);
      if (insertError) console.error("Supabase insert error:", insertError);
    }

    return Response.json({
      summary,
      analysis,
      goodElements: goodElements || undefined,
      badElements: badElements || undefined,
    });
  } catch (error) {
    console.error("Error:", error);
    const msg = getErrorMessage(error);

    if (msg.includes("429") || msg.includes("Too Many Requests")) {
      return Response.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    if (msg.includes("503") || msg.includes("Service Unavailable")) {
      return Response.json(
        { error: "현재 해몽 서비스 이용자가 많아 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    return Response.json(
      { error: "꿈 분석 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
