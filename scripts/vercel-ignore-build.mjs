/*
 * Vercel's Ignored Build Step (`ignoreCommand` in vercel.json): exit 0 skips the deployment, exit 1 builds it.
 *
 * This repository is still connected to the v1 Vercel project (personal account, `ftc-sponsorship-portal`), which
 * must never receive a v2 deployment (plan §11, prompt 4 §H3). Vercel reads vercel.json from the commit it deploys,
 * so every push carries this guard. It builds only when Vercel names the project and it isn't v1; if the project
 * id is missing, it skips (a skipped deploy on the v2 project is visible and harmless; a v2 build on v1 is not).
 * Keep the ids in sync with V1_DENY in scripts/provision/lib.ts.
 */
const V1_PROJECT_IDS = ['prj_UsUAQbUSY1I0Zj5dG4akTAWtOXtV']

const projectId = process.env.VERCEL_PROJECT_ID

if (!projectId) {
  console.log('Skipping: VERCEL_PROJECT_ID is not set, so this project cannot be confirmed as v2.')
  process.exit(0)
}
if (V1_PROJECT_IDS.includes(projectId)) {
  console.log(`Skipping: ${projectId} is the v1 project. FTC Pitfund v2 deploys only to the team-owned project (docs/LAUNCH.md).`)
  process.exit(0)
}
console.log(`Building for ${projectId}.`)
process.exit(1)
