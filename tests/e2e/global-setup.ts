import { execSync } from 'node:child_process'

export default async function setup(): Promise<void> {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'inherit',
  })
}
