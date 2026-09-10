/**
 * Tindahan Ko — Expo config (React Native port of the web prototype).
 *
 * SECURITY: no API keys live in this file or anywhere in the repo.
 * The GLM key used by Suki AI is entered by the user in the in-app
 * Settings screen and stored ONLY in the on-device SQLite database.
 * EXPO_PUBLIC_GLM_API_KEY / EXPO_PUBLIC_GLM_BASE_URL / EXPO_PUBLIC_GLM_MODEL
 * are optional DEV conveniences read from a local (gitignored) .env at
 * build time — never commit a real key.
 */
const pkg = require("./package.json");

module.exports = {
  expo: {
    name: "Tindahan Ko",
    slug: "tindahan-ko",
    description:
      "Simple na digital notebook para sa sari-sari store: utang, benta, gastos, restock, at si Suki AI.",
    version: pkg.version ?? "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "tindahan",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      // warm beige from the Tindahan Ko brand logo (#FCEBCB) — splash icon is a
      // transparent centered lockup; the background itself lives here in config
      backgroundColor: "#FCEBCB",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tindahanko.app",
      infoPlist: {
        NSCameraUsageDescription:
          "Kailangan ng camera para kunan ang resibo ng supplier.",
        NSPhotoLibraryUsageDescription:
          "Para makapili ng larawan ng resibo mula sa gallery.",
      },
    },
    android: {
      package: "com.tindahanko.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        // same warm beige as the launcher icon so legacy + adaptive match
        backgroundColor: "#FCEBCB",
      },
      edgeToEdgeEnabled: true,
      permissions: ["android.permission.CAMERA"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-router", "expo-sqlite"],
    extra: {
      // DEV-only fallbacks; the in-app Settings override always wins.
      glmApiKey: process.env.EXPO_PUBLIC_GLM_API_KEY ?? "",
      glmBaseUrl: process.env.EXPO_PUBLIC_GLM_BASE_URL ?? "",
      glmModel: process.env.EXPO_PUBLIC_GLM_MODEL ?? "",
    },
  },
};
