'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { audit } from '@/lib/server/audit'
import { requireViewer } from '@/lib/server/authz'
import { acceptTerms, cancelJoinRequest, deleteAccount, updateProfile } from '@/lib/server/data/account'
import { markAllNotificationsRead, markNotificationRead, listNotifications } from '@/lib/server/data/notifications'
import { defineAction } from '@/lib/server/result'
import { createSupabaseServerClient } from '@/lib/server/supabase'
import { inTransaction } from '@/lib/server/transaction'
import { profileSchema, welcomeSchema } from '@/lib/shared/schemas/account'

export const saveProfile = defineAction(profileSchema, async (input) => {
  const viewer = await requireViewer()
  const saved = await inTransaction(async () => {
    const row = await updateProfile(viewer, { name: input.name, phone: input.phone, jobTitle: viewer.sponsor ? input.jobTitle : undefined })
    await audit({ actorId: viewer.id, action: 'user.profile_updated', entityType: 'user', entityId: viewer.id, data: { fields: Object.keys(input) } })
    return row
  })
  revalidatePath('/', 'layout')
  return saved
})

export const deleteMyAccount = defineAction(z.object({ confirm: z.literal('delete') }), async () => {
  const viewer = await requireViewer()
  await deleteAccount(viewer)
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  return { redirectTo: '/login?deleted=1' }
})

export const fetchNotifications = defineAction(z.object({}), async () => {
  const viewer = await requireViewer()
  return listNotifications(viewer)
})

export const readNotification = defineAction(z.object({ id: z.uuid() }), async ({ id }) => {
  const viewer = await requireViewer()
  return { changed: await markNotificationRead(viewer, id) }
})

export const readAllNotifications = defineAction(z.object({}), async () => {
  const viewer = await requireViewer()
  return { changed: await markAllNotificationsRead(viewer) }
})

export const completeWelcome = defineAction(welcomeSchema, async ({ role, name }) => {
  const viewer = await requireViewer()
  await inTransaction(async () => {
    await acceptTerms(viewer, name)
    await audit({ actorId: viewer.id, action: 'user.terms_accepted', entityType: 'user', entityId: viewer.id, data: { role } })
  })
  return { redirectTo: role === 'team' ? '/welcome/team' : '/welcome/company' }
})

export const cancelMyJoinRequest = defineAction(z.object({ requestId: z.uuid() }), async ({ requestId }) => {
  const viewer = await requireViewer()
  await cancelJoinRequest(viewer, requestId)
  revalidatePath('/welcome')
  return { cancelled: true }
})
