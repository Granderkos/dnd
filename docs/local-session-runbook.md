# Local LAN Session Runbook

Use this for in-person sessions where your PC hosts both Next.js and local Supabase, and players connect over the same Wi-Fi.

## Required `.env.local` format (example only)

Do not commit `.env.local`.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://<YOUR_LAN_IP>:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

### Why `NEXT_PUBLIC_SUPABASE_URL` must use LAN IP (not `127.0.0.1`)

- `127.0.0.1` always means "this same device".
- On a phone, `127.0.0.1` points to the phone, not your host PC.
- For LAN clients, use the host PC LAN IP (for example `http://192.168.50.198:54321`).

## Exact local production commands

Known working flow:

```bash
npx supabase start
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

Equivalent package scripts:

```bash
npm run local:supabase:start
npm run local:build
npm run local:start
```

Optional chained command:

```bash
npm run local:session
```

If troubleshooting, run each command separately so errors are easier to isolate.

## Why `npm run dev` is not recommended for mobile LAN sessions

Dev mode can hang on Loading when webpack HMR websocket fails over LAN:

- `ws://<LAN_IP>:3000/_next/webpack-hmr`

For session reliability, use production mode (`build` + `start`).

## Find LAN IP on Linux

```bash
hostname -I
```

or:

```bash
ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

Pick your non-loopback/private LAN IP.

## Firewall ports (Fedora / Nobara)

```bash
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=54321/tcp --permanent
sudo firewall-cmd --reload
```

## Test from phone

1. Connect phone to same Wi-Fi.
2. Open `http://<YOUR_LAN_IP>:3000`.
3. Login/register and verify pages load.

## Supabase check URLs

The root URL can return:

```json
{"message":"no Route matched with those values"}
```

This alone is not failure. Check these endpoints instead:

- `http://<LAN_IP>:54321/rest/v1/`
- `http://<LAN_IP>:54321/auth/v1/settings`

## Troubleshooting

### HMR websocket loading issue

Symptoms:
- loading spinner never resolves in dev mode
- websocket errors for `/_next/webpack-hmr`

Actions:
- stop dev server
- run production flow (`build` + `start`)

### "Profile not found"

Likely after local DB reset/import with stale browser auth/session state.

Actions:
- sign out if possible
- clear site data/localStorage for the app origin
- or use incognito/private tab
- re-login or re-register local test users

### "Invalid login credentials"

Likely causes:
- local auth users were reset by DB restore
- stale browser session token after restore

Actions:
- clear site data/localStorage or use incognito
- re-register user in current local Supabase state

### Stale browser session after DB restore

Symptoms:
- stuck Loading
- profile mismatch/auth errors

Actions:
- clear browser site data for your LAN host origin
- hard refresh page
- login again

### Supabase not reachable

Actions:
1. Ensure Supabase is running: `npx supabase start`
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` points to LAN IP + `:54321`
3. Verify firewall port `54321/tcp` is open
4. Verify client devices are on same subnet
5. Check `/rest/v1/` and `/auth/v1/settings`

### Non-critical restore warnings (`buckets_vectors` / `vector_indexes`)

Local Supabase restore can show permission warnings like:
- `permission denied for table buckets_vectors`
- `permission denied for table vector_indexes`

If app auth, profiles, and your app tables load correctly, these are often non-critical for this app.

## Shutdown

```bash
npm run local:supabase:stop
```
