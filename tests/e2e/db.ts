import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { PrismaClient } from '../../src/generated/prisma/client'

const prisma = new PrismaClient()
let app: INestApplication

export const uniq = (p: string) => `${p}-${randomUUID().slice(0, 8)}`

export function setApp(a: INestApplication) {
  app = a
}

export function getApp() {
  return app
}

export function server() {
  return app.getHttpServer()
}

const TABLES = ['refresh_tokens', 'transactions', 'categories', 'users'] as const

export async function truncateAll() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)
}

export async function disconnect() {
  await prisma.$disconnect()
}
