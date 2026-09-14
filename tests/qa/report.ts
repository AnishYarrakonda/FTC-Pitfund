import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

/* Global teardown: fold qa/results/*.json into qa/report.json and a readable qa/report.md. */

type Result = {
  scenario: string
  route: string
  path: string
  persona: string
  width: number
  screenshot: string
  status: number
  perf: { ttfbMs: number; lcpMs: number; cls: number } | null
  overlaysOpened: number
  latencies?: Record<string, number>
  failures: string[]
}

export default async function report() {
  if (!existsSync('qa/results')) return
  const results: Result[] = readdirSync('qa/results')
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`qa/results/${f}`, 'utf8')))
    .sort((a, b) => `${a.scenario}${a.route}${a.persona}${a.width}`.localeCompare(`${b.scenario}${b.route}${b.persona}${b.width}`))

  mkdirSync('qa', { recursive: true })
  writeFileSync('qa/report.json', JSON.stringify(results, null, 2))

  const failed = results.filter((r) => r.failures.length > 0)
  const lines = [
    '# QA report',
    '',
    `Generated ${new Date().toISOString()} · ${results.length} checks · ${failed.length} with failures`,
    '',
    failed.length === 0 ? '**All checks passed.** Open the screenshots in `qa/screens/` and judge them against plan §7.' : '## Failures',
    '',
  ]
  for (const r of failed) {
    lines.push(`### ${r.scenario} · ${r.path} · ${r.persona} · ${r.width}px`, '', `Screenshot: \`${r.screenshot}\``, '')
    for (const f of r.failures) lines.push(`- ${f}`)
    lines.push('')
  }
  lines.push('## Performance (1280 px, production build)', '', '| Scenario | Route | Persona | TTFB ms | LCP ms | CLS |', '| --- | --- | --- | ---: | ---: | ---: |')
  for (const r of results.filter((x) => x.perf)) {
    lines.push(`| ${r.scenario} | ${r.path} | ${r.persona} | ${r.perf!.ttfbMs} | ${r.perf!.lcpMs} | ${r.perf!.cls} |`)
  }
  const latency = results.find((r) => r.latencies)
  if (latency?.latencies) {
    lines.push('', '## ActionButton pending latency (/dev/ui)', '', '| Button | ms |', '| --- | ---: |')
    for (const [label, ms] of Object.entries(latency.latencies)) lines.push(`| ${label} | ${ms} |`)
  }
  lines.push('', '## Overlays opened', '', ...results.filter((r) => r.overlaysOpened > 0 && r.width === 1280).map((r) => `- ${r.scenario} ${r.path} (${r.persona}): ${r.overlaysOpened}`))
  writeFileSync('qa/report.md', lines.join('\n') + '\n')
  console.log(`\nQA report: qa/report.md (${failed.length} of ${results.length} with failures)`)
}
