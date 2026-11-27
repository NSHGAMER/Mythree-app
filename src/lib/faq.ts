// Client-side FAQ matching – mirrors public.faq_answer() so most questions are answered from the cached,
// published FAQ list without a database call. Answers are ALWAYS the admin-approved FAQ text.

export interface FaqItem {
  id: string
  question: string
  answer: string
  keywords: string[]
  category: string
}

const STOP = new Set(
  'what whats the and how does did can will when where why who which this that are was have has get many much there about with you your our please tell should would could any for from into its not need want know mythree sir madam hello namaste thanks thank also then than them they she him her his one all way use is a i to of in on it be am my me do or an we us so if at by no up'.split(' '),
)

export function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && !STOP.has(t)))]
}

function trigrams(s: string) {
  const out = new Set<string>()
  for (const w of s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const p = `  ${w} `
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3))
  }
  return out
}

/** pg_trgm-style similarity in [0, 1]. */
export function similarity(a: string, b: string) {
  const A = trigrams(a)
  const B = trigrams(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

export function scoreFaq(query: string, faq: FaqItem) {
  const q = tokens(query)
  if (!q.length) return 0
  const words = new Set([...tokens(faq.question), ...faq.keywords.map((k) => k.toLowerCase())])
  let sum = 0
  for (const t of q) {
    if (words.has(t)) sum += 1
    else if (t.length >= 3 && [...words].some((w) => w.length >= 3 && (w.startsWith(t) || t.startsWith(w)))) sum += 0.8
  }
  return sum / q.length + similarity(faq.question, query) * 0.2
}

export const CONFIDENCE = 0.5

export function matchFaqs(query: string, faqs: FaqItem[], limit = 3) {
  return faqs
    .map((f) => ({ ...f, score: scoreFaq(query, f) }))
    .filter((f) => f.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
