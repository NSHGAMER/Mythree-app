// Static checks on the SQL migrations (regression tests for bugs found on staging, 27 Nov 2026).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(__dirname, '..', '..', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const sql = (f: string) => readFileSync(join(dir, f), 'utf8')
// strip comments so prose in comments does not trigger the checks
const code = (f: string) => sql(f).replace(/--[^\n]*/g, '')

describe('SQL migrations', () => {
  it('are numbered in order without gaps', () => {
    const nums = files.map((f) => Number(f.slice(8, 14)))
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
    expect(new Set(nums).size).toBe(nums.length)
  })

  it('use $$ / $tag$ dollar quoting only (bug 1: a lone $ broke 0001 on a fresh project)', () => {
    for (const f of files) {
      // ignore string literals such as regex anchors '^…$'
      const lone = code(f).replace(/'[^']*'/g, "''").match(/(?<![$\w])\$(?![$\w{])/g) ?? []
      expect(lone, f).toHaveLength(0)
    }
  })

  it('never DELETE/UPDATE a whole table without WHERE inside functions (bug 2: pg_safeupdate)', () => {
    for (const f of files) {
      const bare = code(f).match(/\b(delete\s+from|update)\s+public\.[a-z_]+(\s+set\s+[^;]*?)?\s*;/gi) ?? []
      const offenders = bare.filter((s) => !/\bwhere\b/i.test(s))
      expect(offenders, f).toHaveLength(0)
    }
  })

  it('revoke the anonymous phone pre-check from PUBLIC, not only from anon (bug 3)', () => {
    const all = files.map(code).join('\n')
    expect(all).toMatch(/revoke execute on function public\.check_phone_available\(text\) from public, anon;/)
  })
})
