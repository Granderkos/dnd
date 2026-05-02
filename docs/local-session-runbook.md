# Local LAN Session Runbook

This runbook is for testing the root app over a local network (desktop host + mobile client).

## Recommended command flow

1. Start local Supabase:

```bash
npx supabase start
```

2. Build production assets:

```bash
npm run build
```

3. Run Next.js on all interfaces:

```bash
npm run start -- -H 0.0.0.0 -p 3000
```

## `.env.local` template (no secrets)

Create/update `.env.local` with LAN-safe placeholders only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://<LAN_IP>:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
```

- Do **not** commit secrets.
- `NEXT_PUBLIC_SUPABASE_URL` must use the host LAN IP (for example `192.168.1.50`), not `127.0.0.1`.

## Why `npm run dev` is not recommended for mobile LAN sessions

`npm run dev` relies on webpack/HMR websocket behavior that can hang on some mobile browsers and LAN setups. For stable mobile tests, prefer `build + start`.

## Linux host IP discovery

Use one of:

```bash
hostname -I
```

or

```bash
ip -4 addr show
```

Pick the IPv4 address on your active LAN interface.

## Fedora / Nobara firewall ports

Open required ports:

- `3000/tcp` (Next.js app)
- `54321/tcp` (Supabase local API gateway)

Example with `firewall-cmd`:

```bash
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=54321/tcp --permanent
sudo firewall-cmd --reload
```

## Supabase availability checks

From another LAN device/browser, verify:

- `http://<LAN_IP>:54321/rest/v1/`
- `http://<LAN_IP>:54321/auth/v1/settings`

Expected outcome: reachable endpoint responses (auth/settings usually returns JSON).

## Troubleshooting: stale browser session / "Profile not found"

If mobile clients show stale auth state or "Profile not found":

1. Sign out in app (if possible).
2. Clear site data/cookies for the LAN URL.
3. Fully close/reopen mobile browser tab.
4. Re-login to force a fresh Supabase session + profile fetch.
5. If needed, restart Supabase and re-test from a new private tab.
