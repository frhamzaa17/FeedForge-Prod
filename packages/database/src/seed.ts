import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { organizations } from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed the database')
}

const client = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(client)

async function seed() {
  await db
    .insert(organizations)
    .values({
      name: '0.5 Show Demo',
      slug: 'zpf-demo',
      plan: 'internal',
    })
    .onConflictDoNothing({ target: organizations.slug })

  await client.end()
}

seed().catch(async (error) => {
  console.error(error)
  await client.end()
  process.exit(1)
})
