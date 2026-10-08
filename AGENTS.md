This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Stack

Tripagent, an AI trip planner. **Android only for v1.** `PLAN.md` is the source of truth (architecture, phases, constraints): read it before starting work and tick its boxes once a step is verified.

- Expo SDK 57, Expo Router (screens in `src/app/`), NativeWind 4.2.7 (Tailwind 3)
- Auth: Clerk · DB: Neon + Drizzle · Background jobs: Inngest
- Backend: Expo API Routes (`src/app/api/**/+api.ts`) on EAS Hosting
- AI: Claude (Anthropic SDK), model id centralized in server config
- Google Places (store only `place_id`), Unsplash (hotlinked directly, photographer credited), ImageKit (user uploads only)
- Monitoring: Sentry

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
- Never start the dev server yourself (`npx expo start`): the user runs it in their own terminal. If you need a test server, say so first, and stop it when done.

## Conventions

- Always use native tabs (`NativeTabs`). The import path depends on the SDK version: check the Expo Router native tabs docs (https://docs.expo.dev/router/advanced/native-tabs/) before using it. On Android the tab bar holds 5 tabs at most.
- Style with NativeWind `className`, not `StyleSheet`.
- One feature = one commit.

## Security

- Secrets never go in the app bundle and never take an `EXPO_PUBLIC_` prefix. They live in the gitignored `.env` locally and in EAS environment variables for builds.
- Every API route verifies the Clerk JWT before doing anything else.
- Webhooks verify the svix signature.

## Visual checks

The dev machine is Windows with an Android emulator. Take screenshots with `adb exec-out screencap -p > screen.png` and look at them before declaring UI work done.
