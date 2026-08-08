# Kairo

A student productivity workspace that reshapes itself around what needs to be done.

```bash
bun install --frozen-lockfile
bun run dev
```

The development server starts through Portless. The current prototype is available at `https://kairo.localhost/canvas`.

```bash
bun run check
bun run test
bun run build
```

Database tests skip until `KAIRO_DATABASE_TEST_URL` points at an isolated test or preview database. Browser tests skip until the Playwright Chromium browser is installed.
