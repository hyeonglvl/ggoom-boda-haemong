const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-120b";

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.8 }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: Request) {
  try {
    if (!GROQ_API_KEY) {
      return Response.json({ error: "API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const { dream, interpretation, messages } = await request.json();

    const languageRule = `CRITICAL: Your entire response must be written in pure Korean Hangul (한글) only. Do NOT use Chinese characters, Japanese characters, or English.`;

    const styleRule = `ALL sentences must end with "~입니다" or "~합니다" without exception. Never use "~해요", "~네요", "~죠", or any other endings. Write warmly and conversationally.`;

    const boldRule = `For important keywords, wrap them with ** like **단어**. Only bold NOUNS, never verb dictionary forms.`;

    const interpretationContext = `
원래 꿈: ${dream}
해몽 요약: ${interpretation.summary}
분석: ${(interpretation.analysis as string[]).join(" ")}
${interpretation.goodElements ? `좋은요소: ${interpretation.goodElements}` : ""}
${interpretation.badElements ? `나쁜요소: ${interpretation.badElements}` : ""}
`.trim();

    let systemContent: string;
    let conversationMessages: { role: string; content: string }[];

    const isFollowUp = !messages || messages.length === 0;

    if (isFollowUp) {
      systemContent = `당신은 친근한 한국 꿈 해몽 전문가입니다.
${languageRule}
${styleRule}

다음은 이미 완료된 해몽입니다:
${interpretationContext}

해몽을 더 구체적으로 심화하기 위해, 꿈의 내용 중 불분명하거나 더 알면 도움이 될 부분에 대해 질문 1개만 짧게 하세요.
"혹시 꿈에서 ~하셨나요?" 또는 "꿈에서 ~은 어떤 느낌이었나요?" 형식으로 자연스럽게 물어보세요.
질문은 1개만, 2문장 이내로 간결하게.`;
      conversationMessages = [{ role: "user", content: "추가 질문을 해주세요." }];
    } else {
      systemContent = `당신은 친근한 한국 꿈 해몽 전문가입니다.
${languageRule}
${styleRule}
${boldRule}

다음은 이미 완료된 해몽 정보입니다:
${interpretationContext}

유저의 답변을 바탕으로 꿈 해몽을 더 심화시켜 답변하세요. 3-4문장 이내로 간결하게.`;
      conversationMessages = messages;
    }

    const reply = await callGroq([
      { role: "system", content: systemContent },
      ...conversationMessages,
    ]);

    return Response.json({ reply });
  } catch (error) {
    console.error("Dream chat error:", error);
    return Response.json({ error: "오류가 발생했습니다." }, { status: 500 });
  }
}
