# LOOP — build a screen until it matches its design

Source: Codesistency "Extra Prompts" (LOOP PROMPT), used in the video from 62:41.
Adapted for Tripagent: Windows + Android emulator, dev server run by the user, bounded loop.

Before pasting: the emulator is on, `npx expo start` is running in my terminal, and the
reference image exists in `design/`.

For another screen, replace `auth`, the file names and the "Screen-specific" block.

---

Build the authentication screen by closely recreating the UI from `@design/auth-ui-design.png`.

Your goal is to match the reference design as accurately as possible, including:

* Layout and spacing
* Typography, font sizes, and font weights
* Colors and gradients
* Button styles
* Input fields
* Border radius
* Shadows and depth
* Icons and imagery
* Alignment and padding
* Overall visual hierarchy

Use the existing project structure and styling system (NativeWind `className`, see `AGENTS.md`). Do not redesign or improvise unless something is missing from the reference.

Screen-specific:

* The screen lives at `src/app/(auth)/sign-in.tsx`, as planned in `PLAN.md`.
* Full-bleed screen: no navigation header, the photo goes under a transparent status bar with light icons.
* Background: the same photo as `design/auth-bg-img.png`, with the dark gradient towards the bottom seen in the reference. Never import from `design/`: put an optimized copy in `assets/images/auth-bg.jpg` (JPEG, 1080 px wide, under 400 KB) and use that.
* Logo: recreate the Tripagent mark (mountain with a small "x") as a vector with `react-native-svg`. Do not crop it out of the reference image.
* Buttons: "Continuer avec mon adresse e-mail" (filled, blue, mail icon) and "Continuer avec Google" (outlined, official multicolor Google "G"). Footer links: "Politique de confidentialité" | "Conditions d'utilisation".
* Font: if the reference font is not available, use the closest Google Font through `@expo-google-fonts` and tell me which one you chose.
* Texts are in French as in the reference. Keep them in one constant object at the top of the file, so they can move to i18n in Phase 6.
* This step is UI only: no Clerk logic yet. Buttons and links do nothing for now; Clerk is wired in Phase 3.
* Use only libraries that run in Expo Go, installed with `npx expo install`.
* While the loop runs, make the emulator show this screen (for example a temporary redirect from `src/app/index.tsx`). Remove the temporary redirect at the end and tell me.

After implementing the first version, take a screenshot of the auth screen on the Android emulator and compare it against `@design/auth-ui-design.png`.

How to take screenshots here:

* I'm on Windows with an Android emulator, not an iOS simulator.
* Never start the dev server: it is already running in my terminal. Saving a file reloads the app (Fast Refresh); wait about 3 seconds before the screenshot.
* Capture with `adb exec-out screencap -p > screenshots/auth-01.png`, numbering each round (`auth-02.png`, …). Create `screenshots/` and add it to `.gitignore` if it is not already there.
* If the emulator is not listed by `adb devices`, or the app shows an error screen, stop and tell me. Do not try to fix the emulator.

Then iterate:

1. Identify all visual differences.
2. Update the implementation.
3. Take another emulator screenshot.
4. Compare again.
5. Repeat until the implemented screen is visually as close to the reference as possible.

Be strict with the comparison. Pay attention to small details like spacing, text positioning, button height, shadows, image cropping, and color accuracy.

Do not stop after the first implementation. Keep refining until the emulator screenshot and the reference design look nearly identical, with a limit of 6 rounds. At the end, or at the limit, give me:

* the list of differences that remain, and why each one remains;
* the path of the last screenshot;
* the output of `npx expo lint` and `npx tsc --noEmit`.

Do not commit: I compare the result myself first, then I tell you to commit.
