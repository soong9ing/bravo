import { createClient } from '@supabase/supabase-js';

// .env 파일에 아래 두 값을 넣어 주세요 (Supabase 대시보드 → Project Settings → API)
// VITE_SUPABASE_URL=https://xxxx.supabase.co
// VITE_SUPABASE_ANON_KEY=eyJ...
// anon 키는 RLS(행 단위 보안)로 보호되므로 프론트에 있어도 괜찮지만,
// OpenAI/Claude 같은 AI API 키는 절대 여기에 넣으면 안 돼요.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
