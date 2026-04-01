import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const allowedTypes = new Set(['creature', 'companion'])
const allowedSubtypes = new Set(['monster', 'pet', 'mount', 'summon', 'familiar'])

function validateEntry(entry, sourceFile) {
  if (!allowedTypes.has(entry.type)) {
    throw new Error(`${sourceFile}: invalid type for slug ${entry.slug}`)
  }
  if (!allowedSubtypes.has(entry.subtype)) {
    throw new Error(`${sourceFile}: invalid subtype for slug ${entry.slug}`)
  }
  if (!entry.slug || typeof entry.slug !== 'string') {
    throw new Error(`${sourceFile}: missing slug`)
  }
  if (!entry.name || typeof entry.name !== 'string') {
    throw new Error(`${sourceFile}: missing name for slug ${entry.slug}`)
  }
}

async function readSeed(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${filePath}: expected array`)
  parsed.forEach((entry) => validateEntry(entry, path.basename(filePath)))
  return parsed
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  })

  const root = process.cwd()
  const files = [
    path.join(root, 'seeds', 'creatures.seed.json'),
    path.join(root, 'seeds', 'companions.seed.json'),
  ]

  for (const file of files) {
    const entries = await readSeed(file)
    let insertedCount = 0
    let skippedCount = 0

    for (const entry of entries) {
      const { data: existing, error: existingError } = await supabase
        .from('compendium_entries')
        .select('id')
        .eq('slug', entry.slug)
        .maybeSingle()

      if (existingError) throw existingError
      if (existing) {
        skippedCount += 1
        continue
      }

      const payload = {
        type: entry.type,
        subtype: entry.subtype,
        slug: entry.slug,
        name: entry.name,
        description: entry.description ?? null,
        is_system: true,
        data: entry.data ?? {},
      }

      const { error } = await supabase
        .from('compendium_entries')
        .upsert(payload, { onConflict: 'slug', ignoreDuplicates: true })

      if (error) throw error
      insertedCount += 1
    }

    console.log(`${path.basename(file)}: inserted=${insertedCount}, skipped=${skippedCount}`)
  }

  console.log('Compendium seeds imported successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
