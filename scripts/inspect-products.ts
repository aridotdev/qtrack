import { createClient } from '@libsql/client'

async function main() {
  const c = createClient({ url: 'file:./data/local.db' })
  const r = await c.execute({
    sql: 'SELECT id, code, createdBy, updatedBy FROM products',
    args: []
  })
  console.log(JSON.stringify(r.rows, null, 2))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
