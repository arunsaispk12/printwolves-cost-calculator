import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * `npm run dev` has no Core to talk to, so this answers the same
 * `<base>api/settings` the production admin proxy does, from a local file.
 * Same contract: GET returns { data: { doc, version } }; PUT needs the version
 * it was based on and answers 409 if that has moved on.
 * The file (.local-data/) is git-ignored. It is never used in a production build.
 */
export function localSettings(file = path.resolve('.local-data/calculator-settings.json')): Plugin {
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as { doc: object; version: number }
    } catch {
      return { doc: {}, version: 0 }
    }
  }
  return {
    name: 'local-settings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base
        if (!req.url?.split('?')[0].endsWith(`${base}api/settings`.replace('//', '/'))) return next()
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method === 'GET') return send(200, { data: read() })
        if (req.method === 'PUT') {
          let raw = ''
          req.on('data', (c) => (raw += c))
          req.on('end', () => {
            try {
              const { doc, expected_version } = JSON.parse(raw)
              const current = read()
              if (expected_version !== current.version) {
                return send(409, { message: 'The settings were changed elsewhere.' })
              }
              fs.mkdirSync(path.dirname(file), { recursive: true })
              const next = { doc, version: current.version + 1 }
              fs.writeFileSync(file, JSON.stringify(next, null, 2))
              send(200, { data: next })
            } catch {
              send(400, { message: 'Bad request' })
            }
          })
          return
        }
        send(405, { message: 'Method not allowed' })
      })
    },
  }
}
