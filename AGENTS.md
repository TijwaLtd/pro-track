This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Stack
- Expo (managed, dev build) + React Native + TypeScript (strict)
- Expo Router (file-based routes)
- expo-sqlite (source of truth), versioned SQL migrations
- expo-secure-store (PIN verifier), expo-local-authentication (biometrics/device credential)
- expo-notifications (local only), expo-file-system, expo-image-picker, expo-document-picker, expo-clipboard
- State: Zustand for UI state; data access via repository functions (no SQL in components)
- Dates: date-fns. Validation: zod. Tests: Jest + jest-expo, plus unit tests for migrations and money/date logic.

## Hard rules
1. **No network calls** in v1. No analytics, no remote fonts, no cloud SDKs. Backup to Drive is Phase 3 and must be user-initiated.
2. **Money** is integer minor units. Never use floats for money. Format only at the UI edge via `formatMoney(minor, currency)`; hide `.00`.
3. **Dates:** `due_date` is a floating local date (`YYYY-MM-DD`) and `due_time` is `HH:mm`. Audit timestamps (`created_at`, `paid_at`, etc.) are UTC ISO-8601. Never derive a local day from a UTC string without converting.
4. **Never hard-delete** payments or evidence. Void with reason + activity log. Projects and items are archived, not deleted, once they have financial records.
5. **Transactions:** any multi-table write (payment + evidence + activity log; item complete + log + reminder cancel) runs in one SQLite transaction.
6. `PRAGMA foreign_keys = ON` at every connection open; verify in a startup check.
7. Evidence files live in app-private storage (`documentDirectory/evidence/<paymentId>/`); DB stores relative paths only.
8. Completion status is independent of payment status. Never auto-complete or auto-block.
9. Never log or show PINs, raw M-Pesa text or amounts in console output in production builds.
10. Do not add screens, tabs or features beyond `projects.md` without asking. Minimalism is a requirement.

## Design
- All visual values come from `/design/design.json` tokens. No hardcoded hex, spacing or radii in components.
- Screen specs: `/design/home.json`, `project-detail.json`, `project-item.json`, `entry.json`. Implement them literally; where ambiguous, ask or note an assumption in the PR.
- Project colour is a palette `color_key` stored on the project; derive tints, on-colour text and decorative shapes from it with the helpers in `src/theme/projectColor.ts`.
- Support dynamic type, 48dp minimum touch targets, WCAG AA contrast, reduced-motion, and screen-reader labels on every interactive element.

## Repo layout

app/ Expo Router routes (index, project/[id], item/[id], _layout, lock)
src/db/ connection, migrations/, repositories/, derived.ts (payment status, progress)
src/domain/ money.ts, dates.ts, mpesaParser.ts, reminders.ts
src/features/ home/, project/, item/, lock/, settings/
src/components/ shared UI (Card, Chip, ColorSwatchPicker, WeekStrip, Sheet, Button)
src/theme/ tokens.ts (generated from design.json), projectColor.ts
design/ JSON specs


## Commands
- `npm run dev` start dev client; `npm run lint`; `npm run typecheck`; `npm test`
- `npm run db:check` runs migration tests (fresh create + upgrade from every prior version)

## Definition of done
- Typecheck, lint and tests pass.
- New/changed schema has a numbered migration + migration test.
- Business rules from DATABASE.md section 4 covered by unit tests (partial, over-paid, voided, cancelled items, null expected amount).
- Works fully in airplane mode.
- Screens match design JSON, including empty, loading and error states.
- Accessibility labels present; tested at 200% font scale.

## Working style
- Small PRs by phase (see projects.md). Update docs when behaviour changes.
- Prefer boring, explicit code. No premature abstractions.
- Ask before adding any dependency not listed above.

## Stack changes
- REMOVE app PIN, numpad and PIN hashing. Do NOT store any PIN.
- Lock uses expo-local-authentication with device credential fallback: password/PIN/pattern, plus biometrics if the phone has them enrolled.
- ADD expo-screen-capture (block screenshots/recents preview on the lock-protected screens).
- Forms are scripted chat flows from /design/chat-forms.json, rendered by one `ChatForm` component. No LLM, no network.
- Avatars are bundled SVG assets listed in /design/avatars.json.

## Hard rules changes
- App access requires phone security. On launch and after relock, call getEnrolledLevelAsync(). If SecurityLevel.NONE, show the "lock required" screen and nothing else. Never offer a bypass or a custom PIN.
- Authenticate with authenticateAsync({ disableDeviceFallback: false }) so the phone's password/pattern is accepted. Test on the lowest supported Android version.
- Be honest in docs/UI: the lock gates the UI; it does not encrypt the database.
- No M-Pesa parsing in v1. Store pasted text verbatim in payments.raw_confirmation_text. Do not add parser code or tests; the column and `mpesaParser.ts` stay out of the repo until requested.
- Create flows use ChatForm; edit flows use flat edit sheets.