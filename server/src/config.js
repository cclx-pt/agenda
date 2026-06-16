import 'dotenv/config'

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente em falta: ${name}`)
  }
  return value
}

const isProd = process.env.NODE_ENV === 'production'

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  db: {
    // String de ligação MySQL/MariaDB, ex.:
    // mysql://utilizador:senha@host:3306/base_de_dados
    connectionString: process.env.DATABASE_URL,
    // TLS opcional (Hostinger normalmente não exige para ligações locais).
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    sessionHours: Number(process.env.SESSION_HOURS ?? 8),
  },

  otp: {
    pepper: required('OTP_PEPPER'),
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 10),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
    // Código mestre só para testes locais. NUNCA ativo em produção:
    // mesmo que DEV_MASTER_OTP esteja definido, é forçado a undefined quando isProd.
    devMasterCode: isProd ? undefined : process.env.DEV_MASTER_OTP || undefined,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? 'Agenda CCLX <agenda@cclx.pt>',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@cclx.pt',
    adminName: process.env.SEED_ADMIN_NAME ?? 'Administrador CCLX',
  },

  inradar: {
    baseUrl: process.env.INRADAR_BASE_URL ?? 'https://inradar.com.br/public/v1',
    apiKey: process.env.INCHURCH_API_KEY,
    apiSecret: process.env.INCHURCH_API_SECRET,
    apiVersion: process.env.INCHURCH_API_VERSION ?? 'v1',
  },
}

export const ROLES = ['admin', 'aprovador', 'editor', 'visitante']
