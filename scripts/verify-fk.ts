import { createClient } from '@libsql/client'

async function main() {
  const c = createClient({ url: 'file:./data/local.db' })

  // 1. Cek row products setelah migrate (harus berisi adminId, bukan 'system')
  const prods = await c.execute({
    sql: 'SELECT id, code, createdBy, updatedBy FROM products',
    args: []
  })
  console.log('Products:')
  console.log(JSON.stringify(prods.rows, null, 2))

  // 2. Cek FK pragma aktif
  const fk = await c.execute({ sql: 'PRAGMA foreign_keys', args: [] })
  console.log('\nPRAGMA foreign_keys:', fk.rows)

  // 3. Cek FK definition di products.createdBy
  const fkDef = await c.execute({ sql: "PRAGMA foreign_key_list(products)", args: [] })
  console.log('\nFK on products:')
  console.log(JSON.stringify(fkDef.rows, null, 2))

  // 4. Test FK enforcement: coba insert dengan userId invalid harus gagal
  try {
    await c.execute({
      sql: `INSERT INTO products (code, name, createdBy, updatedBy)
            VALUES ('TEST', 'Test', 'invalid-user-id', 'invalid-user-id')`,
      args: []
    })
    console.log('\n⚠ FK TIDAK enforced — insert bogus berhasil!')
  } catch (e) {
    console.log('\n✓ FK enforced: insert dengan userId invalid ditolak')
    console.log('  →', e instanceof Error ? e.message.split('\n')[0] : e)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
