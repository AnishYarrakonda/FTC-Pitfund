/*
 * npm run provision:sentry [-- --dry-run]   (optional)
 *
 * Creates the "ftc-pitfund" project in the team's Sentry organization (SENTRY_ORG) and stores its
 * DSN as SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN in .env.provision and the Vercel env. Skipped quietly
 * when SENTRY_AUTH_TOKEN isn't set: the app works without Sentry (errors get a local reference id).
 */
import { apiClient, did, dryRun, finish, getValue, heading, plan, saveValue, skip, waitOn } from './lib'
import { findProject, upsertEnv, vercelToken } from './vercel-api'

const PROJECT = 'ftc-pitfund'

export async function provisionSentry() {
  heading('Sentry (optional)')
  const token = getValue('SENTRY_AUTH_TOKEN')
  const org = getValue('SENTRY_ORG')
  if (!token || !org) return skip('SENTRY_AUTH_TOKEN or SENTRY_ORG not set: Sentry is skipped (optional)')
  const api = apiClient(getValue('SENTRY_API_URL') ?? 'https://sentry.io', { Authorization: `Bearer ${token}` }, 'Sentry')

  const { data: projects } = await api<Array<{ slug: string }>>('GET', `/api/0/organizations/${org}/projects/`)
  if (projects.some((p) => p.slug === PROJECT)) {
    skip(`Sentry project ${org}/${PROJECT} exists`)
  } else if (dryRun) {
    plan(`create Sentry project ${org}/${PROJECT}`)
    return
  } else {
    const { data: teams } = await api<Array<{ slug: string }>>('GET', `/api/0/organizations/${org}/teams/`)
    if (!teams[0]) return waitOn(`Create a team in the Sentry organization "${org}", then re-run.`)
    await api('POST', `/api/0/teams/${org}/${teams[0].slug}/projects/`, { name: PROJECT, slug: PROJECT, platform: 'javascript-nextjs' })
    did(`created Sentry project ${org}/${PROJECT}`)
  }

  const { data: keys } = await api<Array<{ dsn: { public: string } }>>('GET', `/api/0/projects/${org}/${PROJECT}/keys/`)
  const dsn = keys[0]?.dsn.public
  if (!dsn) return waitOn(`Sentry project ${PROJECT} has no client key. Create one in Sentry → Project Settings → Client Keys, then re-run.`)
  saveValue('SENTRY_DSN', dsn)
  saveValue('NEXT_PUBLIC_SENTRY_DSN', dsn)

  if (!vercelToken()) return
  const project = await findProject()
  if (!project) return
  await upsertEnv(project, [
    { key: 'SENTRY_DSN', value: dsn, targets: ['production', 'preview'] },
    { key: 'NEXT_PUBLIC_SENTRY_DSN', value: dsn, targets: ['production', 'preview'] },
    { key: 'SENTRY_ORG', value: org, targets: ['production', 'preview'] },
    { key: 'SENTRY_PROJECT', value: PROJECT, targets: ['production', 'preview'] },
  ])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  provisionSentry().then(
    () => finish('provision:sentry'),
    (e) => finish('provision:sentry', e),
  )
}
