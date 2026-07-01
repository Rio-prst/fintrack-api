import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required')
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required')

  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: process.env.CORS_ORIGIN })
  app.use(cookieParser())
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
