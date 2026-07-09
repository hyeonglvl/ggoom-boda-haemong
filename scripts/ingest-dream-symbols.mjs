// data/dream-symbols-ko.json ({ category, source_zh, interpretation_ko }[])을 읽어
// HF Space BGE-M3 엔드포인트로 임베딩하고 Supabase dream_symbols 테이블에 적재한다.
// 사전 준비: HF Space 배포 완료, supabase/dream_symbols.sql 실행, .env.local에
// HF_EMBED_URL / HF_EMBED_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 설정.
// 실행: node --env-file=.env.local scripts/ingest-dream-symbols.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(process.cwd(), "data", "dream-symbols-ko.json");
const EMBED_BATCH_SIZE = 32;
const INSERT_BATCH_SIZE = 200;

const HF_EMBED_URL = process.env.HF_EMBED_URL;
const HF_EMBED_API_KEY = process.env.HF_EMBED_API_KEY || "";
// HF Space가 private이라 자체 EMBED_API_KEY와 별개로 HF 계정 토큰이 필요하다.
const HF_TOKEN = process.env.HF_TOKEN || "";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!HF_EMBED_URL) throw new Error("HF_EMBED_URL이 설정되지 않았습니다.");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
}

// supabase-js는 순수 Node 스크립트에서 Realtime(WebSocket) 클라이언트 초기화 때문에
// "Node.js 20 detected without native WebSocket support" 에러로 죽는다.
// 이 스크립트는 insert만 하면 되므로 REST API를 직접 호출한다.
async function insertRows(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dream_symbols`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert error: ${res.status} ${await res.text()}`);
  }
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function embedBatch(texts) {
  const res = await fetch(`${HF_EMBED_URL}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": HF_EMBED_API_KEY,
      ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
    },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    throw new Error(`HF embed API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.embeddings;
}

const raw = await readFile(INPUT_PATH, "utf-8");
const entries = JSON.parse(raw);

const missingTranslation = entries.find((e) => !e.interpretation_ko?.trim());
if (missingTranslation) {
  throw new Error(
    `interpretation_ko가 비어 있는 항목이 있습니다: ${JSON.stringify(missingTranslation)}`,
  );
}

console.log(`${entries.length}개 항목 임베딩 시작...`);

const rows = [];
for (const batch of chunk(entries, EMBED_BATCH_SIZE)) {
  const embeddings = await embedBatch(batch.map((e) => e.interpretation_ko));
  batch.forEach((entry, i) => {
    rows.push({
      category: entry.category ?? null,
      source_zh: entry.source_zh ?? null,
      interpretation_ko: entry.interpretation_ko,
      embedding: embeddings[i],
    });
  });
  console.log(`  임베딩 진행: ${rows.length}/${entries.length}`);
}

console.log("Supabase에 적재 중...");
let inserted = 0;
for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
  await insertRows(batch);
  inserted += batch.length;
  console.log(`  적재 진행: ${inserted}/${rows.length}`);
}

console.log(`완료: ${rows.length}개 항목을 dream_symbols에 적재했습니다.`);
