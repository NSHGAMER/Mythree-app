-- Stricter FAQ matching for the chatbot: score = share of the question's meaningful words that
-- match an FAQ's question or keywords (exact = 1, prefix = 0.8), plus a small similarity tie-breaker.
-- The app only shows an answer when score >= 0.5, otherwise it hands over to the contact team.
create or replace function public.faq_answer(p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_q text := left(trim(coalesce(p_query, '')), 300);
  v_tokens text[];
  v_results jsonb;
  v_best_id uuid; v_best numeric;
  v_stop text[] := array['what','whats','the','and','how','does','did','can','will','when','where','why','who','which',
    'this','that','are','was','have','has','get','many','much','there','about','with','you','your','our','please',
    'tell','should','would','could','any','for','from','into','its','not','need','want','know','mythree','sir','madam',
    'hello','namaste','thanks','thank','also','then','than','them','they','she','him','her','his','one','all','way','use'];
begin
  if char_length(v_q) < 2 then return jsonb_build_object('matches', '[]'::jsonb); end if;
  if not public.check_rate_limit('faq:' || coalesce(auth.uid()::text, public.client_ip()), 60, 600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  select array_agg(distinct t) into v_tokens
  from unnest(regexp_split_to_array(lower(v_q), '[^[:alnum:]]+')) t
  where char_length(t) >= 2 and not (t = any (v_stop)) and t !~ '^(is|a|i|to|of|in|on|it|be|am|my|me|do|or|an|we|us|so|if|at|by|no|up)$';

  if v_tokens is null then
    insert into public.chatbot_queries (user_id, query, matched_faq_id, confidence) values (auth.uid(), v_q, null, 0);
    return jsonb_build_object('matches', '[]'::jsonb);
  end if;

  with words as (
    select f.id, array_agg(distinct w) as ws
    from public.faqs f,
         lateral unnest(regexp_split_to_array(lower(f.question), '[^[:alnum:]]+') || f.keywords) w
    where f.is_published and char_length(w) >= 2
    group by f.id
  ), scored as (
    select f.id, f.question, f.answer, f.category,
      (select coalesce(sum(case
          when t = any (wd.ws) then 1.0
          when char_length(t) >= 3 and exists (select 1 from unnest(wd.ws) w where char_length(w) >= 3 and (w like t || '%' or t like w || '%')) then 0.8
          else 0 end), 0) from unnest(v_tokens) t) / cardinality(v_tokens)
        + extensions.similarity(f.question, v_q) * 0.2 as score
    from public.faqs f join words wd on wd.id = f.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'question', s.question, 'answer', s.answer,
           'category', s.category, 'score', round(s.score::numeric, 3)) order by s.score desc), '[]'::jsonb)
    into v_results
  from (select * from scored where score > 0.2 order by score desc limit 3) s;

  v_best_id := nullif(v_results->0->>'id', '')::uuid;
  v_best := (v_results->0->>'score')::numeric;
  insert into public.chatbot_queries (user_id, query, matched_faq_id, confidence)
  values (auth.uid(), v_q, case when coalesce(v_best, 0) >= 0.5 then v_best_id end, least(coalesce(v_best, 0), 9.999));

  return jsonb_build_object('matches', v_results);
end $$;

grant execute on function public.faq_answer(text) to anon, authenticated;
