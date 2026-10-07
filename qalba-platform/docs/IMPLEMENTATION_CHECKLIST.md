# Implementation checklist

## Phase 1

- [x] Inspect current workspace (empty; no Git repository)
- [x] Define architecture and relational schema before gameplay
- [x] Configure Next.js/TypeScript/Tailwind, responsive RTL visual system
- [x] PostgreSQL Prisma migration and environment documentation
- [x] Email register/login/logout, durable sessions and SMTP-backed recovery flow
- [x] Protected dashboard, profile, loading/error/404 states
- [x] Lint, typecheck, unit tests, migration/HTTP integration, build and phase 1 E2E checks

## Phase 2 foundation

- [x] Seed starter categories and original sample questions
- [x] Define question validation, status, type, locale and history-aware selection
- [x] Protected initial admin question CRUD and category management
- [x] Test question filtering/selection and admin access

## Phase 3

- [x] Add transactional, idempotent host commands with optimistic state versions
- [x] Implement 18-cell Category Board, scoring, steal, timer, reveal, skip, undo and five powers
- [x] Persist question snapshots, per-account question history, rounds and score events
- [x] Enable game setup, responsive host board, full-board victory and rematch
- [x] Expand original seed to 36 questions and protect admin configuration on reseed
- [x] Run unit, migration/HTTP integration, browser E2E, lint, typecheck and build

## Phase 4

- [x] Phase 4: host controls (manual score edit, game pause/end) and a separate TV projection with fullscreen

## Phase 5

- [x] Configurable welcome credits and one-time account grant
- [x] Atomic, idempotent credit debit when a game starts
- [x] Profile game/purchase history and wallet balance
- [x] Protected admin grant and starter-credit setting
- [x] Test duplicate starts, insufficient balance, rematches and history

## Phase 6

- [x] Account management with suspension and role safeguards
- [x] Game modes, power-ups, products, coupons and feature flags
- [x] Question reporting and moderation
- [x] CSV question import/export with validation and bounded transactions
- [x] Real dashboard metrics, purchases and usage views
- [x] Lint, typecheck, unit/integration/E2E tests and build

## Phase 7

- [x] Expiring six-character rooms, guest-scoped sessions and ready lobby
- [x] Live projection, guest responses/multiple-choice votes and host review
- [x] Migration, unit/integration/E2E, lint, typecheck and build

## Phase 8

- [x] Seven isolated game modules and original sample content
- [x] Transactional sessions, scores, question history and one-time credit debit
- [x] Shared host setup, responsive play and redacted TV projection
- [x] Unit and full-session integration tests for every mode

## Phase 9

- [x] Database-priced hosted checkout and configurable coupon reservations
- [x] Moyasar adapter behind provider interface; server-side invoice fetch on callbacks
- [x] Atomic, idempotent wallet crediting and pending invoice reconciliation
- [x] Player pricing, purchase status and admin purchase list
- [x] Mock-provider integration, route and browser tests

## Phase 10

- [x] Transactional lifecycle events for registration, games, questions, powers, purchases and rooms
- [x] Allowlisted analytics properties, admin 30-day aggregates and 90-day retention job
- [x] Security headers, payment URL validation, authorization and CSRF regression checks
- [x] Unit, migration/HTTP, game/payment integration, E2E and production build gates
