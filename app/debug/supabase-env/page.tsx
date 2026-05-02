function maskEnvValue(value: string | undefined) {
  if (!value) return 'not set'
  if (value.length <= 8) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
}

export default function SupabaseEnvDebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const rows = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      configured: Boolean(supabaseUrl),
      maskedValue: maskEnvValue(supabaseUrl),
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      configured: Boolean(supabaseAnonKey),
      maskedValue: maskEnvValue(supabaseAnonKey),
    },
  ]

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Supabase Environment Check</h1>
      <p className="text-sm text-muted-foreground">
        This page intentionally masks values and only helps verify configuration status.
      </p>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Variable</th>
              <th className="p-3">Configured</th>
              <th className="p-3">Masked Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t">
                <td className="p-3 font-mono">{row.name}</td>
                <td className="p-3">{row.configured ? 'yes' : 'no'}</td>
                <td className="p-3 font-mono">{row.maskedValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
