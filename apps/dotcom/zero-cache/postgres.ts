import { existsSync } from 'fs'
import postgres from 'postgres'

const init = `
CREATE SCHEMA IF NOT EXISTS migrations;

CREATE TABLE IF NOT EXISTS migrations.applied_migrations (
  filename VARCHAR PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

export async function waitForPostgres() {
	let attempts = 0
	do {
		try {
			const sql = postgres(postgresConnectionString, {
				connection: {
					application_name: 'waitForPostgres',
				},
			})
			await sql`SELECT 1`
			await sql.end()
			break
		} catch (_e) {
			if (attempts++ > 100) {
				throw new Error('Failed to connect to postgres')
			}
			console.log('Waiting for postgres' + '.'.repeat(attempts))
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
		// eslint-disable-next-line no-constant-condition
	} while (true)
	const sql = postgres(postgresConnectionString)
	await sql.unsafe(init).simple()
	await sql.end()
}

export const postgresConnectionString: string =
	process.env.BOTCOM_POSTGRES_POOLED_CONNECTION_STRING ||
	'postgresql://user:password@127.0.0.1:6543/postgres'

if (!postgresConnectionString) {
	throw new Error('Missing BOTCOM_POSTGRES_POOLED_CONNECTION_STRING env var')
}

export const migrationsPath = `./migrations`
if (!existsSync(migrationsPath)) {
	throw new Error(`Migrations path not found: ${migrationsPath}`)
}
