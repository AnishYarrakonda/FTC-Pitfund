import { afterAll } from 'vitest'

import { closeDb } from '@/lib/server/db'

afterAll(async () => {
  await closeDb()
})
