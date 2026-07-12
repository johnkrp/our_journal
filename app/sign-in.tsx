// app/sign-in.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator
} from "react-native";
import { AppColors, Radius, Spacing } from "../constants/design";
import { supabase, ALLOWED_UIDS } from "../lib/supabase";
import { router } from "expo-router";
import { getErrorMessage } from "../lib/errors";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const onSignIn = async () => {
    if (!email || !password) {
      setMsg("Συμπλήρωσε email και κωδικό.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      const user = data.user;
      if (!user) {
        setMsg("Αποτυχία σύνδεσης.");
        return;
      }
      // Έλεγχος λίστας επιτρεπόμενων UIDs
      if (!ALLOWED_UIDS.includes(user.id)) {
        setMsg("Private app: this account is not allowed.");
        // Αν κάποιος τρίτος συνδεθεί κατά λάθος, κάνε sign out
        await supabase.auth.signOut();
        return;
      }

      // Δημιούργησε/ενημέρωσε προφίλ για καλό και για κακό
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.email ?? "user",
      });

      // Πήγαινε στην αρχική
      router.replace("/");
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Sign in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        padding: Spacing.lg,
        gap: Spacing.md,
        alignItems: "stretch",
        justifyContent: "center",
        backgroundColor: AppColors.card,
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: "800" }}>Our Journal 💜</Text>
      <Text style={{ color: AppColors.subtext, marginBottom: Spacing.sm }}>
        Private login (2 users only)
      </Text>

      {!!msg && (
        <Text style={{ color: "crimson", marginBottom: 6 }}>{msg}</Text>
      )}

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: AppColors.border,
          padding: Spacing.md,
          borderRadius: Radius.sm,
        }}
      />

      <View style={{ position: "relative" }}>
        <TextInput
          placeholder="Password"
          secureTextEntry={!showPass}
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: AppColors.border,
            padding: Spacing.md,
            borderRadius: Radius.sm,
            paddingRight: 70,
          }}
        />
        <Pressable
          onPress={() => setShowPass((s) => !s)}
          style={{
            position: "absolute",
            right: 10,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ color: "#111" }}>{showPass ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onSignIn}
        disabled={busy}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: Radius.md,
          alignItems: "center",
          marginTop: Spacing.sm,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "white", fontWeight: "700" }}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}


