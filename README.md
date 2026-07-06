# Citymap

Application Expo / React Native.

## Get started

1. Install dependencies

   ```bash
   npm ci
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Android APK with GitHub Actions

The workflow `.github/workflows/build-apk.yml` builds an Android APK with EAS and publishes it as the `citymap-android.apk` asset on the `android-latest` GitHub release.

Required setup:

1. Create an Expo access token at https://expo.dev/settings/access-tokens.
2. Add it to this GitHub repository as an Actions secret named `EXPO_TOKEN`.
3. Make sure the app has been initialized on EAS at least once, so EAS credentials and the project ID exist for non-interactive CI builds.
4. Run the `Build Android APK` workflow from GitHub Actions, or push to `main`.

The direct APK URL used by the landing page is:

```bash
https://github.com/LGVbtw/citymap/releases/latest/download/citymap-android.apk
```

## GitHub Pages landing page

The static landing page lives in `docs/index.html` and is deployed by `.github/workflows/pages.yml`.

Expected public URL:

```bash
https://lgvbtw.github.io/citymap/
```

If Pages is not enabled yet, set GitHub Pages to use GitHub Actions in the repository settings.

## Local checks

```bash
npx expo lint
```

## Useful Expo references

- Expo SDK 56 reference: https://docs.expo.dev/versions/v56.0.0/
- APK builds with EAS: https://docs.expo.dev/build-reference/apk/
- EAS builds from CI: https://docs.expo.dev/build/building-on-ci/
