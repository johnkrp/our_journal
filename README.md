# Our Journal

Private React Native app (Expo + Supabase) for tracking memories and future trip ideas.

## Stack

- Expo Router (file-based navigation)
- React Native + TypeScript
- Supabase (auth, database, storage)
- Google Places + map-based browsing

## Prerequisites

- Node.js 20+
- npm
- Expo Go app on your phone

## Environment Variables

Create `.env` in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_ALLOWED_UIDS=uid1,uid2
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...
```

## Run (Lightweight, Recommended)

```bash
npm install
npx expo start --go --lan
```

Then open the shown `exp://...` URL in Expo Go, or scan the QR code.

## Optional Native Build

Use this only when you need native modules not supported by Expo Go:

```bash
npm run android
```

This path uses Gradle/Java and is heavier on CPU/RAM.

## Project Structure

- `app/`: screens and routes
- `components/`: reusable UI
- `lib/`: Supabase and app config helpers
- `assets/`: images and icons

## Scripts

- `npm run start`: start Expo dev server
- `npm run android`: run Android native build
- `npm run ios`: run iOS native build
- `npm run web`: run web target
- `npm run lint`: run lint checks
