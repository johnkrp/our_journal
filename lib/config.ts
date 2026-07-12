function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[config] Missing required env var: ${name}. Add it to your .env file.`
    );
  }
  return value;
}

export const SUPABASE_URL = getRequiredEnv("EXPO_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = getRequiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
export const GOOGLE_MAPS_KEY = getRequiredEnv("EXPO_PUBLIC_GOOGLE_MAPS_KEY");
