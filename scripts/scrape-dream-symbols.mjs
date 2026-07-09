// 위키문고 周公解夢(주공해몽) 원문을 wikitext API로 가져와
// { category, source_zh } 목록으로 파싱해 data/dream-symbols-raw.json에 저장한다.
// 실행: node scripts/scrape-dream-symbols.mjs

import { writeFile } from "node:fs/promises";
import path from "node:path";

const TITLE = "周公解夢";
const API_URL = `https://zh.wikisource.org/w/api.php?action=query&titles=${encodeURIComponent(TITLE)}&prop=revisions&rvprop=content&rvslots=main&format=json`;
const OUTPUT_PATH = path.join(process.cwd(), "data", "dream-symbols-raw.json");

const HANZI_ONLY = /^[一-鿿]+$/;
const CATEGORY_HEADING = /^==\s*(.+?)\s*==$/;

async function fetchWikitext() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Wikisource API error: ${res.status}`);
  const data = await res.json();
  const pages = data.query?.pages;
  const page = pages && Object.values(pages)[0];
  const wikitext = page?.revisions?.[0]?.slots?.main?.["*"];
  if (!wikitext) throw new Error("wikitext를 찾지 못했습니다.");
  return wikitext;
}

function parseEntries(wikitext) {
  const entries = [];
  let currentCategory = null;

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(CATEGORY_HEADING);
    if (headingMatch) {
      currentCategory = headingMatch[1];
      continue;
    }

    if (!currentCategory) continue; // 카테고리 진입 전 서문(詩) 등은 제외
    if (line.startsWith("{{")) continue;

    for (const part of line.split(/[\s　]+/)) {
      if (part && HANZI_ONLY.test(part)) {
        entries.push({ category: currentCategory, source_zh: part });
      }
    }
  }

  return entries;
}

const wikitext = await fetchWikitext();
const entries = parseEntries(wikitext);

if (entries.length < 500) {
  throw new Error(`파싱된 항목이 비정상적으로 적습니다 (${entries.length}개). 원문 구조가 바뀌었을 수 있습니다.`);
}

await writeFile(OUTPUT_PATH, JSON.stringify(entries, null, 2), "utf-8");
console.log(`${entries.length}개 항목을 ${OUTPUT_PATH}에 저장했습니다.`);
