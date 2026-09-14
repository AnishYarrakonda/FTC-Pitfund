'use server'

import { checkBotId } from 'botid/server'

import { createReport } from '@/lib/server/data/reports'
import { scheduleDrain } from '@/lib/server/email/drain'
import { AppError, defineAction } from '@/lib/server/result'
import { inTransaction } from '@/lib/server/transaction'
import { getViewer } from '@/lib/server/viewer'
import { reportSchema } from '@/lib/shared/schemas/team'

/* "Report this page" on the public team page (prompt 2, scope C). Open to anyone, bot-checked. */

export const reportTeamPage = defineAction(reportSchema, async (input) => {
  const verification = await checkBotId()
  if (verification.isBot) throw new AppError('FORBIDDEN', "We couldn't verify this request. Refresh the page and try again.")
  const viewer = await getViewer()
  await inTransaction(() => createReport(viewer, input))
  await scheduleDrain()
  return { received: true }
})
