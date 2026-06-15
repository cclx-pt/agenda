import express from 'express'
import { config } from '../config.js'

/**
 * Proxy de leitura para a API pública inChurch/inRadar.
 *
 * Em desenvolvimento o Vite trata deste proxy; em produção (VPS) o Vite não
 * existe, por isso o backend assume essa função. As credenciais ficam apenas
 * no `.env` do servidor e nunca chegam ao browser.
 *
 * Âmbito: apenas leitura do endpoint `/event/` (a app é só de agenda).
 */
export const inradarRouter = express.Router()

const credentials = Buffer.from(
  `${config.inradar.apiKey ?? ''}:${config.inradar.apiSecret ?? ''}`
).toString('base64')

inradarRouter.use(async (req, res, next) => {
  // Só leitura.
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  // Restringe ao endpoint de eventos (a app é exclusivamente de agenda).
  if (!/^\/event\b/.test(req.url) && !/^\/event\//.test(req.url)) {
    return res.status(404).json({ error: 'Recurso não disponível.' })
  }

  if (!config.inradar.apiKey || !config.inradar.apiSecret) {
    return res.status(500).json({ error: 'API inRadar não configurada no servidor.' })
  }

  try {
    const upstream = await fetch(`${config.inradar.baseUrl}${req.url}`, {
      headers: {
        Authorization: `Basic ${credentials}`,
        'X-API-Version': config.inradar.apiVersion,
        Accept: 'application/json',
      },
    })

    const body = await upstream.text()
    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.set('Content-Type', contentType)
    return res.send(body)
  } catch (err) {
    return next(err)
  }
})
