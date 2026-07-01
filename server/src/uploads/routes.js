import { Router } from 'express'
import multer from 'multer'
import { requireRole } from '../middleware/auth.js'
import { uploadImage, isStorageConfigured } from '../storage/supabase.js'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
// Imagens PNG/JPG (banner) e PDF (anexos de evento).
const ALLOWED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['application/pdf', '.pdf'],
])

// O ficheiro fica em memória para ser reencaminhado ao Supabase Storage...
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('Formato inválido. Apenas PDF, PNG ou JPG.'))
      return
    }
    cb(null, true)
  },
})

export const uploadsRouter = Router()

// Apenas quem gere eventos pode carregar imagens.
const manageRoles = requireRole('admin', 'aprovador', 'editor')

// POST /data/uploads — recebe um ficheiro no campo "file", carrega-o para o
// Supabase Storage e devolve o URL público (absoluto) da imagem.
uploadsRouter.post('/', manageRoles, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande (máx. 5MB).' : 'Falha no upload.'
      return res.status(400).json({ error: message })
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha no upload.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro recebido.' })
    }
    if (!isStorageConfigured()) {
      return res.status(503).json({ error: 'Armazenamento de imagens não configurado.' })
    }
    try {
      const ext = ALLOWED.get(req.file.mimetype) ?? '.bin'
      const url = await uploadImage(req.file.buffer, { ext, contentType: req.file.mimetype })
      res.status(201).json({ url })
    } catch (uploadErr) {
      console.error('[uploads] Falha no Supabase Storage:', uploadErr?.message ?? uploadErr)
      res.status(502).json({ error: 'Falha ao guardar a imagem.' })
    }
  })
})
