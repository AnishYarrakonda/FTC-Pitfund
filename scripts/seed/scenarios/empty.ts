import { buildWorld } from '../world'

/** `empty`: personas and their orgs exist with no content (first-run and empty states). */
export const run = () => buildWorld('empty')
