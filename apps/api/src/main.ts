import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return
  const missing: string[] = []
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'local-development-key') {
    missing.push('ENCRYPTION_KEY (must be a unique 64-char hex value in production)')
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    missing.push('At least one AI provider key: ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY')
  }
  if (missing.length) {
    console.error('❌ Missing required production environment variables:')
    for (const v of missing) console.error(`   • ${v}`)
    process.exit(1)
  }
}

async function bootstrap() {
  assertProductionSecrets()
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) ?? ['http://localhost:3000'],
    credentials: true,
  })
  await app.listen(Number(process.env.PORT ?? 4000))
}

void bootstrap()
