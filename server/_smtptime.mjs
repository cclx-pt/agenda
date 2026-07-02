import { config } from './src/config.js'
import nodemailer from 'nodemailer'

console.log('pass length:', (config.smtp.pass || '').length)
const t0 = Date.now()
const tx = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 25000,
})
const t1 = Date.now()
try {
  await tx.verify()
  const t2 = Date.now()
  const info = await tx.sendMail({
    from: config.smtp.from,
    to: config.smtp.user,
    subject: 'Teste de tempo OTP',
    text: 'teste de medicao de tempo',
  })
  const t3 = Date.now()
  console.log(`verify (connect+TLS+auth): ${t2 - t1} ms`)
  console.log(`sendMail: ${t3 - t2} ms`)
  console.log(`TOTAL (verify+send): ${t3 - t1} ms`)
  console.log('messageId:', info.messageId)
} catch (e) {
  console.log('ERRO:', e.message)
} finally {
  tx.close()
}
