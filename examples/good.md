# Acme Web

## Project overview
Acme Web is the customer dashboard for Acme. Next.js 15 + TypeScript, Postgres via Prisma, deployed on Vercel.

## Commands
```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Code style
- Use pnpm, never npm.
- Named exports only; no default exports.
- Functions under 40 lines; extract helpers otherwise.
- Use 2 spaces.

## Project structure
- `src/app/`: routes
- `src/lib/`: shared utilities
- `prisma/`: schema and migrations
