/*
 * Vercel REST API helpers (https://vercel.com/docs/rest-api). The project always lives under the
 * team-owned account, never the v1 personal project (see V1_DENY).
 */
import { apiClient, config, did, dryRun, fail, getValue, plan, skip, V1_DENY, warn, type Api } from './lib'

export type VercelTeam = { id: string; slug: string; name: string }
export type VercelProject = {
  id: string
  name: string
  accountId: string
  link?: { type?: string; org?: string; repo?: string; repoId?: number; productionBranch?: string }
  protectionBypass?: Record<string, { scope: string }>
  ssoProtection?: { deploymentType: string } | null
  serverlessFunctionRegion?: string | null
  /** System env vars (VERCEL_PROJECT_ID) in builds: vercel.json's ignoreCommand needs it to build (scripts/vercel-ignore-build.mjs). */
  autoExposeSystemEnvs?: boolean
}
export type EnvTarget = 'production' | 'preview'
export type EnvVar = { key: string; value: string; targets: EnvTarget[]; sensitive?: boolean; comment?: string }

export function vercelToken() {
  return getValue('VERCEL_TOKEN')
}

let cachedTeam: { api: Api; team: VercelTeam; query: string; userEmail: string | null } | null = null

/** The team the token acts for: VERCEL_TEAM_SLUG, or the account's only/default team. */
export async function vercelScope() {
  if (cachedTeam) return cachedTeam
  const token = vercelToken()
  if (!token) fail('VERCEL_TOKEN is missing from .env.provision (Vercel → Account Settings → Tokens).')
  const bare = apiClient('https://api.vercel.com', { Authorization: `Bearer ${token}` }, 'Vercel')
  const { data: me } = await bare<{ user: { email?: string; defaultTeamId?: string | null } }>('GET', '/v2/user')
  const { data } = await bare<{ teams: VercelTeam[] }>('GET', '/v2/teams?limit=100')
  const wanted = getValue('VERCEL_TEAM_SLUG')
  const team = wanted
    ? data.teams.find((t) => t.slug === wanted)
    : (data.teams.find((t) => t.id === me.user.defaultTeamId) ?? (data.teams.length === 1 ? data.teams[0] : undefined))
  if (!team) {
    fail(
      wanted
        ? `The Vercel token can't see a team with slug "${wanted}". Teams it can see: ${data.teams.map((t) => t.slug).join(', ') || 'none'}.`
        : `Set VERCEL_TEAM_SLUG in .env.provision. The token can see: ${data.teams.map((t) => t.slug).join(', ') || 'no teams'}.`,
    )
  }
  if (V1_DENY.vercelTeamIds.includes(team.id)) {
    fail(`The Vercel token points at the v1 team (${team.slug}). Create the token while signed in as the ${'team account'} instead.`)
  }
  const query = `teamId=${team.id}`
  const api: Api = (method, path, body, opts) => bare(method, `${path}${path.includes('?') ? '&' : '?'}${query}`, body, opts)
  cachedTeam = { api, team, query, userEmail: me.user.email ?? null }
  return cachedTeam
}

export async function findProject(): Promise<VercelProject | null> {
  const { api } = await vercelScope()
  const name = config().vercelProject
  if (V1_DENY.vercelProjectNames.includes(name)) fail(`Refusing to use "${name}": that is the v1 Vercel project.`)
  const { status, data } = await api<VercelProject>('GET', `/v9/projects/${encodeURIComponent(name)}`, undefined, { allow: [404] })
  if (status === 404) return null
  if (V1_DENY.vercelProjectIds.includes(data.id)) fail(`Refusing to use project ${data.id}: that is the v1 Vercel project.`)
  return data
}

/** Create or update env vars (upsert). Values already equal are left alone; sensitive ones can't be read back, so they are rewritten. */
export async function upsertEnv(project: VercelProject, vars: EnvVar[]) {
  const { api } = await vercelScope()
  const { data } = await api<{ envs: Array<{ id: string; key: string; target?: string[]; type: string; value?: string }> }>(
    'GET',
    `/v10/projects/${project.id}/env?decrypt=true`,
  )
  for (const v of vars) {
    for (const target of v.targets) {
      const existing = data.envs.find((e) => e.key === v.key && e.target?.includes(target))
      if (existing && existing.type !== 'sensitive' && existing.value === v.value) {
        skip(`${v.key} (${target}) already set`)
        continue
      }
      if (dryRun) {
        plan(`${existing ? 'update' : 'add'} ${v.key} for ${target}`)
        continue
      }
      // An entry shared by several targets must be split so each target gets its own value.
      if (existing && (existing.target?.length ?? 0) > 1) {
        await api('DELETE', `/v9/projects/${project.id}/env/${existing.id}`)
      }
      await api('POST', `/v10/projects/${project.id}/env?upsert=true`, {
        key: v.key,
        value: v.value,
        type: v.sensitive ? 'sensitive' : 'encrypted',
        target: [target],
        comment: v.comment,
      })
      did(`${existing ? 'updated' : 'added'} ${v.key} for ${target}`)
    }
  }
}

export function warnIfNotTeamAccount(email: string | null) {
  if (email && email.toLowerCase() !== 'ftcexodius@gmail.com') {
    warn(`The Vercel token belongs to ${email}, not ftcexodius@gmail.com. Production must be owned by the team account.`)
  }
}
