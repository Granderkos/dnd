# Local LAN Session Runbook

This runbook is for in-person sessions where the app and Supabase both run on your local machine, and players connect from phones/laptops on the same Wi-Fi.

## Prerequisites

- Docker running (for local Supabase)
- Node/npm installed
- Same Wi-Fi network for host + player devices

## Required `.env.local` format

Create `.env.local` in project root (do not commit this file):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://<YOUR_LAN_IP>:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

### Why `NEXT_PUBLIC_SUPABASE_URL` must use LAN IP (not `127.0.0.1`)

- `127.0.0.1` points to the **device itself**.
- On phones/laptops, `127.0.0.1` means the phone/laptop, not your host PC.
- Using your host machine LAN IP (for example `192.168.1.50`) lets other devices on Wi-Fi reach local Supabase.

## Recommended startup (production mode)

Use production mode for sessions:

```bash
npm run local:supabase:start
npm run local:build
npm run local:start
```

Or one command:

```bash
npm run local:session
```

> `local:session` chains commands and prints errors directly. If troubleshooting, run each command in separate terminals so failures are easier to isolate.

## Why `npm run dev` is not recommended for mobile LAN sessions

- Dev mode uses HMR/WebSocket behavior that can be flaky across some LAN/mobile setups.
- Production mode (`next build` + `next start`) is closer to actual deployed behavior and is more stable for in-person sessions.

## Find your LAN IP on Linux

Run one of these:

```bash
hostname -I
```

or:

```bash
ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

Use the non-loopback address (not `127.0.0.1`).

## Test from phone

1. Ensure phone is on same Wi-Fi as host PC.
2. Open browser on phone to:
   - `http://<YOUR_LAN_IP>:3000`
3. Verify app loads and can log in.

## Troubleshooting

### HMR/WebSocket loading issues (dev mode)

Symptoms:
- intermittent page hangs
- stale updates
- websocket reconnect loops

Actions:
- Stop `npm run dev`
- Use production commands instead:
  - `npm run local:build`
  - `npm run local:start`

### "Profile not found"

Possible causes:
- Supabase local instance reset (old users gone)
- auth user exists but related profile row was not created

Actions:
- Check Supabase container/logs
- Re-register test user in local environment
- Confirm local Supabase URL/keys in `.env.local` match running instance

### Supabase not reachable

Symptoms:
- auth/database requests fail immediately

Actions:
1. Confirm Supabase is running:
   - `npm run local:supabase:start`
2. Verify URL in `.env.local` points to host LAN IP and correct port (`54321`)
3. Ensure host firewall allows inbound LAN traffic for required ports
4. Confirm phone/laptop is on same Wi-Fi subnet

## Shutdown

```bash
npm run local:supabase:stop
```
