import { describe, expect, it, vi } from 'vitest'

import type { Viewer } from '@/lib/shared/viewer'

import { buildPersonas, dbTest } from './helpers/db'

/*
 * The authz matrix, extended from the guards to every server action added for the company side and
 * the admin console (prompt 3): each action runs as each persona with valid input, and must refuse
 * (UNAUTHORIZED / FORBIDDEN) everyone its guard excludes before touching data. The request's viewer
 * is swapped in by mocking getViewer; Next's request-only helpers are no-ops outside a request.
 */

const current: { viewer: Viewer | null } = { viewer: null }

vi.mock('@/lib/server/viewer', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, getViewer: async () => current.viewer }
})
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<object>()), after: () => {} }))
vi.mock('next/cache', async (importOriginal) => ({ ...(await importOriginal<object>()), updateTag: () => {}, revalidateTag: () => {}, revalidatePath: () => {} }))

type Persona = 'anonymous' | 'admin' | 'admin-suspended' | 'coach' | 'coach-new' | 'sponsor-new' | 'sponsor-pending' | 'sponsor' | 'sponsor-rejected' | 'sponsor-suspended' | 'suspended-user'
const ALL: Persona[] = ['anonymous', 'admin', 'admin-suspended', 'coach', 'coach-new', 'sponsor-new', 'sponsor-pending', 'sponsor', 'sponsor-rejected', 'sponsor-suspended', 'suspended-user']

const DENIED = new Set(['UNAUTHORIZED', 'FORBIDDEN'])
const id = () => crypto.randomUUID()

describe('action authz matrix', () => {
  it(
    'every company, inbox and admin action refuses the personas its guard excludes',
    dbTest(async () => {
      const company = await import('@/app/actions/company')
      const inbox = await import('@/app/actions/inbox')
      const admin = await import('@/app/actions/admin')
      const { viewers } = await buildPersonas()

      const anyone: Persona[] = ['admin', 'coach-new', 'sponsor-new', 'coach', 'sponsor-pending', 'sponsor', 'sponsor-rejected', 'sponsor-suspended']
      // Editing what you sent us is allowed in every state except suspended — including while it
      // waits, so a typo doesn't have to sit in the queue.
      const companyMembers: Persona[] = ['sponsor-pending', 'sponsor', 'sponsor-rejected']
      const approvedCompany: Persona[] = ['sponsor']
      const admins: Persona[] = ['admin']

      const ACTIONS: Array<[string, () => Promise<{ ok: boolean; error?: { code: string } }>, Persona[]]> = [
        ['createCompanyAction', () => company.createCompanyAction({ name: 'Matrix Co', website: 'matrix.example', yourName: 'Pat', jobTitle: 'Lead', linkedin: '', adult: true, terms: true }), anyone],
        ['saveCompanyProfile', () => company.saveCompanyProfile({ name: 'Matrix Co', website: 'matrix.example', city: '', state: '', region: '', about: '', supportTypes: [] }), companyMembers],
        ['saveQuestions', () => company.saveQuestions({ questions: [{ id: 'q1', prompt: 'Why?', required: true }] }), companyMembers],
        ['keepDefaultQuestions', () => company.keepDefaultQuestions({}), companyMembers],
        ['createCompanyUploadUrl', async () => ({ ok: true }), companyMembers],
        ['saveCompanyLogo', () => company.saveCompanyLogo({ path: 'sponsors/x/upload-00000000-0000-4000-8000-000000000000.webp' }), companyMembers],
        ['inviteCompanyMember', () => company.inviteCompanyMember({ email: `matrix-${id()}@example.com` }), approvedCompany],
        ['resendCompanyInvite', () => company.resendCompanyInvite({ inviteId: id() }), approvedCompany],
        // Changing who is on the account is the owner's, and only once the company is in the app.
        ['revokeCompanyInvite', () => company.revokeCompanyInvite({ inviteId: id() }), approvedCompany],
        ['removeCompanyMemberAction', () => company.removeCompanyMemberAction({ userId: id() }), approvedCompany],
        ['transferCompanyOwnershipAction', () => company.transferCompanyOwnershipAction({ userId: id() }), approvedCompany],
        // Leaving is every member's, whatever state the company is in.
        ['leaveCompanyAction', () => company.leaveCompanyAction({ confirm: 'leave' }), ['sponsor-pending', 'sponsor', 'sponsor-rejected']],
        ['respondInterestedAction', () => inbox.respondInterestedAction({ pitchId: id() }), approvedCompany],
        ['respondNotAFitAction', () => inbox.respondNotAFitAction({ pitchId: id(), reason: null, note: null }), approvedCompany],
        ['approvePitchAction', () => admin.approvePitchAction({ pitchId: id() }), admins],
        ['sendBackPitchAction', () => admin.sendBackPitchAction({ pitchId: id(), note: 'Fix it' }), admins],
        ['rejectPitchAction', () => admin.rejectPitchAction({ pitchId: id(), note: '' }), admins],
        ['approveCompanyAction', () => admin.approveCompanyAction({ sponsorId: id() }), admins],
        ['rejectCompanyAction', () => admin.rejectCompanyAction({ sponsorId: id(), note: 'No' }), admins],
        ['suspendCompanyAction', () => admin.suspendCompanyAction({ sponsorId: id() }), admins],
        ['unsuspendCompanyAction', () => admin.unsuspendCompanyAction({ sponsorId: id() }), admins],
        ['deleteCompanyAction', () => admin.deleteCompanyAction({ sponsorId: id(), confirmName: 'x' }), admins],
        ['approveTeamAction', () => admin.approveTeamAction({ teamId: id() }), admins],
        ['rejectTeamAction', () => admin.rejectTeamAction({ teamId: id(), note: 'No' }), admins],
        ['suspendTeamAction', () => admin.suspendTeamAction({ teamId: id() }), admins],
        ['unsuspendTeamAction', () => admin.unsuspendTeamAction({ teamId: id() }), admins],
        ['recheckTeamAction', () => admin.recheckTeamAction({ teamId: id() }), admins],
        ['deleteTeamAction', () => admin.deleteTeamAction({ teamId: id(), confirmName: 'x' }), admins],
        ['resolveReportAction', () => admin.resolveReportAction({ reportId: id(), suspendTeam: false }), admins],
        ['setAdminAction', () => admin.setAdminAction({ userId: id(), grant: true }), admins],
        ['setUserSuspendedAction', () => admin.setUserSuspendedAction({ userId: id(), suspended: true }), admins],
        ['removeFromOrgAction', () => admin.removeFromOrgAction({ userId: id() }), admins],
        ['retryEmailAction', () => admin.retryEmailAction({ id: id() }), admins],
        ['dismissEmailAction', () => admin.dismissEmailAction({ id: id() }), admins],
        ['sendEmailNowAction', () => admin.sendEmailNowAction({ id: id() }), admins],
      ]
      // createCompanyUploadUrl talks to storage when allowed; check only its refusals.
      ACTIONS[4][1] = () => company.createCompanyUploadUrl({ imageType: 'image/webp' })

      const mismatches: string[] = []
      for (const [name, run, allowed] of ACTIONS) {
        for (const persona of ALL) {
          if (name === 'createCompanyUploadUrl' && allowed.includes(persona)) continue
          current.viewer = persona === 'anonymous' ? null : viewers[persona]
          const result = await run()
          const code = result.ok ? 'ok' : result.error!.code
          if (code === 'VALIDATION') mismatches.push(`${name} × ${persona}: invalid test input`)
          const refused = DENIED.has(code)
          if (allowed.includes(persona) === refused) mismatches.push(`${name} × ${persona}: got ${code}`)
        }
      }
      current.viewer = null
      expect(mismatches).toEqual([])
    }),
    60_000,
  )
})
