/*
 * Pitch questions (plan §1 rule 6, §4). A company may define up to 10; when it defines none,
 * these three defaults apply, with {Company} replaced by the company name (fillCompany).
 */

export type Question = { id: string; prompt: string; help?: string; required: boolean }

export const MAX_QUESTIONS = 10
export const MAX_ANSWER_LENGTH = 2000
export const MAX_QUESTION_PROMPT = 200
export const MAX_QUESTION_HELP = 300

export const DEFAULT_QUESTIONS: Question[] = [
  { id: 'default-why', prompt: 'Why are you reaching out to {Company} specifically?', required: true },
  { id: 'default-impact', prompt: 'What would {Company’s} support make possible for your team this season?', required: true },
  {
    id: 'default-connection',
    prompt: 'Do you have any connection to {Company}: employees, parents, location, or events?',
    required: false,
  },
]

/** Puts the company name into a default prompt: `{Company}` → "Allele", `{Company’s}` → "Allele’s" or "Allele Components’". */
export function fillCompany(prompt: string, name: string) {
  return prompt.replaceAll('{Company’s}', /s$/i.test(name) ? `${name}’` : `${name}’s`).replaceAll('{Company}', name)
}

export function questionsFor(company: { name: string; questions: Question[] | null | undefined }): Question[] {
  const source = company.questions && company.questions.length > 0 ? company.questions : DEFAULT_QUESTIONS
  return source.map((q) => ({ ...q, prompt: fillCompany(q.prompt, company.name) }))
}
