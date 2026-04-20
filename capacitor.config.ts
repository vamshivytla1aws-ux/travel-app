import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jaibhavani.travels",
  appName: "Jai Bhavani Travels",
  webDir: "capacitor-www",
  server: {
    url: "https://web-production-d3d31.up.railway.app",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
