# UPSC COMMANDER — v1.0

A mobile-first UPSC study planner built as a Progressive Web App (PWA), with optional Firebase multi-user cloud sync and an Android packaging path using Capacitor.

## What works now

- Demo mode with local device storage (no account or Firebase required)
- Daily planner: add, complete, and delete tasks
- Date-specific task lists
- Subject progress tracker
- Focus timer (25 / 50 / 60 minutes)
- Study analytics for the last 7 days
- JSON data export
- Responsive dark UI and PWA service worker

## Important: demo mode vs multi-user cloud mode

Demo mode is immediately usable, but its data stays in that browser/device. For real multi-user accounts and cloud sync, configure Firebase as described below. Do not publish the app with Firebase configuration incomplete and assume cloud sync is active.

## Step 1 — Run the app locally

The app uses ES modules, so serve it over HTTP (do not open `index.html` directly as a file).

Beginner-friendly option:
1. Install Visual Studio Code on a computer.
2. Open this project folder.
3. Install the VS Code extension "Live Server".
4. Right-click `index.html` → "Open with Live Server".
5. On Android, open the local network URL only if your phone and computer are on the same Wi-Fi and your firewall permits it.

For an Android-only first test, upload the folder to a static host (GitHub Pages, Netlify, or Firebase Hosting), then open the HTTPS URL in Chrome.

## Step 2 — Enable Firebase for multi-user accounts

1. Open https://console.firebase.google.com/ and create a project named `upsc-commander` (or another unique project ID).
2. Add a Web App in Project Overview.
3. Copy the Firebase web configuration.
4. Open `app.js` and replace the placeholder values in `FIREBASE_CONFIG`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
5. In Firebase Console → Authentication → Get started → Sign-in method, enable **Email/Password**.
6. In Firestore Database → Create database.
7. Choose production mode, then open Rules and paste the contents of `firestore.rules`.
8. Publish the rules.
9. Reload the hosted app. Create an account. Each account's data is stored under its own `users/{uid}` path.

Firebase web configuration is not a server secret. Security depends on Authentication and Firestore Security Rules. Never add a service-account private key to this frontend project.

## Step 3 — Publish the web app

Recommended simple route:
1. Create a GitHub repository.
2. Upload all project files to the repository root.
3. In repository Settings → Pages, choose deploy from branch and select `main` / root.
4. Wait for the HTTPS Pages URL.
5. Open the URL on Android Chrome → menu → Add to Home screen / Install app.

You can also use Netlify or Firebase Hosting.

## Step 4 — Build Android APK with Capacitor (computer required)

A computer with Node.js LTS and Android Studio is required for the standard APK build.

1. Install Node.js LTS and Android Studio.
2. In a terminal inside the project folder, run:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "UPSC COMMANDER" "com.akm.upsccommander" --web-dir .
npx cap add android
npx cap copy android
npx cap open android
```

3. In Android Studio, wait for Gradle sync.
4. Select Build → Build Bundle(s) / APK(s) → Build APK(s).
5. Android Studio shows the generated APK location.

For future changes to the web files, run `npx cap copy android` again before rebuilding.

Note: Android Studio is not available on most Android phones. You can use the PWA on your phone immediately; APK packaging is best done on a computer.

## Current v1 limitations / next development steps

- The timer records a session when the countdown finishes. If the app is closed mid-session, that unfinished timer is not recorded.
- No admin console or roles yet. This first release is a student workspace with separate user accounts.
- Push notifications, recurring reminders, topic-level syllabus, MCQ test bank, and admin management are planned for later versions.
- Before public launch, add privacy policy, terms, abuse protection, Firebase App Check, and tested backup/restore procedures.

## Folder structure

- `index.html` — app screens
- `styles.css` — responsive dark theme
- `app.js` — app logic, demo storage, Firebase integration
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline app shell cache
- `firestore.rules` — per-user cloud data access rules
