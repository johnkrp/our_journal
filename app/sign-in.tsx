// app/sign-in.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase, ALLOWED_UIDS } from "../lib/supabase";
import { router } from "expo-router";

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
    } catch (e: any) {
      setMsg(e?.message || "Κάτι πήγε στραβά.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        gap: 12,
        alignItems: "stretch",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: "800" }}>Our Journal 💜</Text>
      <Text style={{ color: "gray", marginBottom: 8 }}>
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
          borderColor: "#ddd",
          padding: 12,
          borderRadius: 10,
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
            borderColor: "#ddd",
            padding: 12,
            borderRadius: 10,
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
          borderRadius: 12,
          alignItems: "center",
          marginTop: 6,
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
