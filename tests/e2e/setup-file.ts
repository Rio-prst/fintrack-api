import { ValidationPipe } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { AppModule } from '../../src/app.module'
import { disconnect, getApp, setApp, truncateAll } from './db'

let app = getApp()

beforeAll(async () => {
  if (getApp()) return
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  app = module.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  await app.init()
  setApp(app)
}, 30_000)

afterAll(async () => {
  const a = getApp()
  if (a) await a.close()
  await disconnect()
})

beforeEach(async () => {
  await truncateAll()
})
