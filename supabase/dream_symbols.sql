-- 주공해몽 RAG용 스키마. Supabase SQL Editor에서 1회 실행.
-- documnetation 용으로 그냥 가지고 있음 ㅋㅋ supabase table 한번 보면됨.
-- 삭제하면 진짜 슬플 예정;

create extension if not exists vector;

create table if not exists dream_symbols (
  id bigint generated always as identity primary key,
  category text,
  source_zh text,
  interpretation_ko text,
  embedding vector(1024),
  created_at timestamptz default now()
);

create index if not exists dream_symbols_embedding_idx
  on dream_symbols using hnsw (embedding vector_cosine_ops);

create or replace function match_dream_symbols(
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id bigint,
  category text,
  source_zh text,
  interpretation_ko text,
  similarity float
)
language sql stable
as $$
  select
    id,
    category,
    source_zh,
    interpretation_ko,
    1 - (embedding <=> query_embedding) as similarity
  from dream_symbols
  order by embedding <=> query_embedding
  limit match_count;
$$;
