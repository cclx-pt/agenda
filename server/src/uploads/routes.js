import { Router } from 'express'
import multer from 'multer'
import { requireRole } from '../middleware/auth.js'
import { uploadImage, createSignedVideoUpload, isStorageConfigured } from '../storage/supabase.js'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024 // 30 MB
// Imagens PNG/JPG, PDF e vídeos do Loop.
const ALLOWED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['application/pdf', '.pdf'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
])

// O ficheiro fica em memória para ser reencaminhado ao Supabase Storage...
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('Formato inválido. Apenas PDF, PNG, JPG, MP4 ou WebM.'))
      return
    }
    cb(null, true)
  },
})

export const uploadsRouter = Router()

// Apenas quem gere eventos pode carregar imagens.
const manageRoles = requireRole('admin', 'aprovador', 'editor')

// Autoriza um upload direto browser → Supabase. O ficheiro não atravessa a
// função Vercel, cujo limite de corpo é inferior aos 30 MB permitidos aqui.
uploadsRouter.post('/sign-video', manageRoles, async (req, res) => {
  const contentType = String(req.body?.contentType || '').toLowerCase()
  const size = Number(req.body?.size)
  if (contentType !== 'video/mp4') {
    return res.status(400).json({ error: 'Formato inválido. Apenas MP4.' })
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return res.status(400).json({ error: 'Ficheiro demasiado grande (máx. 30MB).' })
  }
  if (!isStorageConfigured()) {
    return res.status(503).json({ error: 'Armazenamento de ficheiros não configurado.' })
  }
  try {
    res.json(await createSignedVideoUpload())
  } catch (uploadErr) {
    const detail = uploadErr?.message ?? String(uploadErr)
    console.error('[uploads] Falha ao autorizar vídeo:', detail)
    res.status(502).json({ error: `Falha ao preparar o upload: ${detail}` })
  }
})

// POST /data/uploads — recebe um ficheiro no campo "file", carrega-o para o
// Supabase Storage e devolve o URL público (absoluto) da imagem.
uploadsRouter.post('/', manageRoles, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande (máx. 30MB).' : 'Falha no upload.'
      return res.status(400).json({ error: message })
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha no upload.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro recebido.' })
    }
    if (!req.file.mimetype.startsWith('video/') && req.file.size > MAX_FILE_BYTES) {
      return res.status(400).json({ error: 'Ficheiro demasiado grande (máx. 5MB).' })
    }
    if (!isStorageConfigured()) {
      return res.status(503).json({ error: 'Armazenamento de imagens não configurado.' })
    }
    try {
      const ext = ALLOWED.get(req.file.mimetype) ?? '.bin'
      const url = await uploadImage(req.file.buffer, { ext, contentType: req.file.mimetype })
      res.status(201).json({ url })
    } catch (uploadErr) {
      const detail = uploadErr?.message ?? String(uploadErr)
      console.error('[uploads] Falha no Supabase Storage:', detail)
      res.status(502).json({ error: `Falha ao guardar o ficheiro: ${detail}` })
    }
  })
})
