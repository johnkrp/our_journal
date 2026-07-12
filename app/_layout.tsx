import { Session } from "@supabase/supabase-js";
import { Redirect, Stack, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ALLOWED_UIDS, supabase } from "../lib/supabase";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSession(data.session);
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  const uid = session?.user?.id;
  const allowed = uid && ALLOWED_UIDS.includes(uid);

  if (!session || !allowed) {
    if (pathname !== "/sign-in") return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
      <Stack.Screen name="add" />
      <Stack.Screen name="my-posts" />
      <Stack.Screen name="timeline" />
      <Stack.Screen name="dreams" />
      <Stack.Screen name="post/[id]" />
    </Stack>
  );
}
