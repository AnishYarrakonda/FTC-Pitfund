import { initBotId } from 'botid/client/core'

// Bot protection on the email-code request (a server action POST to /login) and the public report form.
initBotId({
  protect: [
    { path: '/login', method: 'POST' },
    { path: '/t/*', method: 'POST' },
  ],
})
