// app/add.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import { decode as base64Decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type LocalPhoto = {
  id: string;
  uri: string;
};

const colors = {
  bg: "#FFF1F2",
  card: "#FFFFFF",
  accent: "#ec4899",
  accentDark: "#be185d",
  text: "#111827",
  subtext: "#6b7280",
  border: "#f5d0ea",
};

function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function Add() {
  const params = useLocalSearchParams<{
    id?: string; // ⭐ όταν κάνουμε edit
    name?: string;
    address?: string;
    lat?: string;
    lng?: string;
    keyword?: string;
    body?: string;
    visited_at?: string;
  }>();

  const isEdit = !!params.id;

  // --------- INITIAL STATE (create + edit) ----------
  const [title, setTitle] = useState(params.name ?? "");
  const [body, setBody] = useState(params.body ?? "");

  const initialVisited = useMemo(() => {
    if (params.visited_at && isValidISODate(params.visited_at)) {
      return params.visited_at;
    }
    return new Date().toISOString().slice(0, 10);
  }, [params.visited_at]);

  const [visitedAt, setVisitedAt] = useState(initialVisited);
  const [placeName, setPlaceName] = useState(params.name ?? "");
  const [address, setAddress] = useState(params.address ?? "");

  // keyword από params (είτε από post, είτε από index.tsx)
  const [keyword, setKeyword] = useState(params.keyword ?? "");

  // lat/lng κρατιούνται “κρυφά”, απλά για αποθήκευση
  const [lat, setLat] = useState(params.lat ?? "");
  const [lng, setLng] = useState(params.lng ?? "");

  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState<Date>(() => {
    if (params.visited_at && isValidISODate(params.visited_at)) {
      return new Date(params.visited_at + "T00:00:00");
    }
    return new Date();
  });
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // ⭐ λίστα με όλα τα keywords από posts + dreams
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(true);

  const canSave = useMemo(() => {
    if (busy) return false;
    if (!title.trim()) return false;
    if (!isValidISODate(visitedAt)) return false;
    return true;
  }, [title, visitedAt, busy]);

  // --------- LOAD KEYWORDS (posts + dreams) ----------
  useEffect(() => {
    const loadKeywords = async () => {
      try {
        setLoadingKeywords(true);
        const [postsRes, dreamsRes] = await Promise.all([
          supabase.from("posts").select("keyword").not("keyword", "is", null),
          supabase.from("dreams").select("keyword").not("keyword", "is", null),
        ]);

        const set = new Set<string>();

        if (!postsRes.error && postsRes.data) {
          (postsRes.data as { keyword: string | null }[]).forEach((row) => {
            if (row.keyword) set.add(row.keyword);
          });
        }

        if (!dreamsRes.error && dreamsRes.data) {
          (dreamsRes.data as { keyword: string | null }[]).forEach((row) => {
            if (row.keyword) set.add(row.keyword);
          });
        }

        setKeywords(Array.from(set));
      } catch (e) {
        console.log("ADD loadKeywords error:", e);
      } finally {
        setLoadingKeywords(false);
      }
    };

    loadKeywords();
  }, []);

  // --------- PHOTOS (νέες φωτογραφίες) ----------
  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission", "Χρειάζεται άδεια για τη βιβλιοθήκη.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 10,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!res.canceled) {
      const assets = res.assets ?? [];
      const newOnes: LocalPhoto[] = assets.map((a) => ({
        id: `${Date.now()}-${Math.random()}`,
        uri: a.uri,
      }));
      setPhotos((prev) => [...prev, ...newOnes]);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission", "Χρειάζεται άδεια για την κάμερα.");
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setPhotos((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, uri: res.assets[0].uri },
      ]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // --------- UPLOAD (χωρίς blob, με base64) ----------
  const uploadImage = async (
    postId: string,
    photo: LocalPhoto,
    idx: number
  ) => {
    const manip = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    const base64 = await FileSystem.readAsStringAsync(manip.uri, {
      encoding: "base64",
    });

    const arrayBuffer = base64Decode(base64);
    const path = `${postId}/${Date.now()}_${idx}.jpg`;

    const { data, error } = await supabase.storage
      .from("photos")
      .upload(path, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    const { error: mediaErr } = await supabase
      .from("media")
      .insert({ post_id: postId, url: data.path });

    if (mediaErr) throw mediaErr;

    // Αν είναι η πρώτη νέα φωτογραφία, την κάνουμε cover
    if (idx === 0) {
      const { error: coverErr } = await supabase
        .from("posts")
        .update({ cover_url: data.path })
        .eq("id", postId);

      if (coverErr) throw coverErr;
    }
  };

  // --------- SAVE (create + edit) ----------
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!canSave) {
        throw new Error("Συμπλήρωσε τουλάχιστον τίτλο και σωστή ημερομηνία.");
      }

      if (lat && isNaN(Number(lat)))
        throw new Error("Lat πρέπει να είναι αριθμός.");
      if (lng && isNaN(Number(lng)))
        throw new Error("Lng πρέπει να είναι αριθμός.");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Δεν είσαι συνδεδεμένος.");

      const { error: profErr } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.email ?? "user",
      });
      if (profErr) throw profErr;

      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        visited_at: visitedAt || null,
        place_name: placeName.trim() || null,
        address: address.trim() || null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        keyword: keyword.trim() || null,
      };

      let postId: string;

      if (isEdit && params.id) {
        // ⭐ EDIT MODE → UPDATE
        const { data: post, error: postErr } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", params.id)
          .eq("author_id", user.id)
          .select("*")
          .single();

        if (postErr) throw postErr;
        postId = post.id;
      } else {
        // ⭐ CREATE MODE → INSERT
        const { data: post, error: postErr } = await supabase
          .from("posts")
          .insert({
            author_id: user.id,
            ...payload,
          })
          .select("*")
          .single();

        if (postErr) throw postErr;
        postId = post.id;
      }

      // ΝΕΕΣ φωτογραφίες (υπάρχουσες μένουν όπως είναι)
      for (let i = 0; i < photos.length; i++) {
        await uploadImage(postId, photos[i], i);
      }

      if (isEdit && params.id) {
        Alert.alert("Saved", "Η ανάμνηση ενημερώθηκε 💗");
        router.replace({
          pathname: "/post/[id]",
          params: { id: postId },
        });
      } else {
        Alert.alert("Saved", "Η ανάμνηση αποθηκεύτηκε 💗");
        router.replace("/my-posts");
      }
    } catch (e: any) {
      console.log("SAVE ERROR:", e);
      const msg = e?.message || "Κάτι πήγε στραβά.";
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  // --------- UI ----------
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "#fee2e2",
              }}
            >
              <Text style={{ color: colors.accentDark, fontWeight: "600" }}>
                ←
              </Text>
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 20 }}>💗</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: colors.accentDark,
                }}
              >
                Τι ωραία που ήταν! 😙
              </Text>
            </View>
            <View style={{ width: 25 }} />
          </View>

          {error && (
            <Text style={{ color: "crimson", marginBottom: 6 }}>{error}</Text>
          )}

          {/* Κάρτα με πεδία */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              marginBottom: 14,
            }}
          >
            {/* Title */}
            <Text style={{ fontWeight: "600", color: colors.subtext }}>
              Τίτλος
            </Text>
            <TextInput
              placeholder="Τίτλος της ανάμνησης"
              value={title}
              onChangeText={setTitle}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 10,
                borderRadius: 10,
                marginTop: 6,
                marginBottom: 10,
                backgroundColor: "#F9FAFB",
                color: colors.text,
              }}
            />

            {/* Keyword chips (dropdown-like) */}
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontWeight: "600", color: colors.subtext }}>
                Λέξη-κλειδί
              </Text>

              {loadingKeywords ? (
                <View
                  style={{
                    marginTop: 6,
                    paddingVertical: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color={colors.accentDark} />
                </View>
              ) : keywords.length === 0 ? (
                <View
                  style={{
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.subtext }}>
                    Δεν υπάρχουν ακόμα keywords. Μπορείς να προσθέσεις μία
                    λέξη-κλειδί αργότερα από άλλη οθόνη.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ columnGap: 8, marginTop: 8 }}
                >
                  {keywords.map((k) => {
                    const active = keyword === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setKeyword(active ? "" : k)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active
                            ? colors.accentDark
                            : colors.border,
                          backgroundColor: active ? "#fce7f3" : "#F9FAFB",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: active ? colors.accentDark : colors.subtext,
                          }}
                        >
                          #{k}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Notes */}
            <Text
              style={{
                fontWeight: "600",
                color: colors.subtext,
                marginTop: 14,
              }}
            >
              Περιγραφή
            </Text>
            <TextInput
              placeholder="Σκέψεις, αστείες στιγμές, τι θυμάσαι από εδώ…"
              multiline
              value={body}
              onChangeText={setBody}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 10,
                borderRadius: 10,
                marginTop: 6,
                backgroundColor: "#F9FAFB",
                minHeight: 80,
                textAlignVertical: "top",
                color: colors.text,
              }}
            />

            {/* Date (Visited) */}
            <Text
              style={{
                marginTop: 12,
                fontWeight: "600",
                color: colors.subtext,
              }}
            >
              Ημερομηνία
            </Text>

            <Pressable
              onPress={() => {
                setTempDate(dateObj);
                setShowDatePicker(true);
              }}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                marginTop: 6,
                backgroundColor: "#F9FAFB",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: visitedAt ? colors.text : colors.subtext }}>
                {visitedAt || "Choose a date"}
              </Text>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </Pressable>

            {/* Place */}
            <Text
              style={{
                marginTop: 14,
                fontWeight: "600",
                color: colors.subtext,
              }}
            >
              Μέρος
            </Text>
            <TextInput
              placeholder="Όνομα μέρους"
              value={placeName}
              onChangeText={setPlaceName}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 10,
                borderRadius: 10,
                marginTop: 6,
                backgroundColor: "#F9FAFB",
                color: colors.text,
              }}
            />
            <TextInput
              placeholder="Διεύθυνση"
              value={address}
              onChangeText={setAddress}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 10,
                borderRadius: 10,
                marginTop: 6,
                backgroundColor: "#F9FAFB",
                color: colors.text,
              }}
            />
          </View>

          {/* Photos section */}
          <Text
            style={{
              fontWeight: "700",
              color: colors.subtext,
              marginBottom: 6,
            }}
          >
            Φωτογραφίες
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <Pressable
              onPress={pickFromLibrary}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 14,
                paddingVertical: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>📸</Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: colors.subtext,
                  fontWeight: "600",
                }}
              >
                Έχουμε ήδη!
              </Text>
            </Pressable>

            <Pressable
              onPress={takePhoto}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 14,
                paddingVertical: 10,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>✨</Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: colors.subtext,
                  fontWeight: "600",
                }}
              >
                Ας βγάλουμε τώρα!
              </Text>
            </Pressable>
          </View>

          {photos.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {photos.map((p) => (
                <Pressable
                  key={p.id}
                  onLongPress={() => removePhoto(p.id)}
                  style={{
                    width: "31%",
                    aspectRatio: 1,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#fee2e2",
                  }}
                >
                  <Image
                    source={{ uri: p.uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Save button */}
          <Pressable
            onPress={save}
            disabled={!canSave}
            style={{
              marginTop: 8,
              backgroundColor: canSave ? colors.accentDark : "#9CA3AF",
              paddingVertical: 14,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "700",
                  letterSpacing: 0.4,
                }}
              >
                {isEdit
                  ? "Αποθήκευση αλλαγών 🥰"
                  : "Θα το θυμώμαστε για πάντα 🫶"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DATE PICKER MODAL */}
      <Modal
        transparent
        visible={showDatePicker}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowDatePicker(false)}
          />

          <View
            style={{
              backgroundColor: "#FFE4EF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 20,
              paddingTop: 8,
            }}
          >
            {/* Header bar */}
            <View
              style={{
                backgroundColor: "#FBC9E3",
                paddingVertical: 12,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomWidth: 1,
                borderBottomColor: "#F5B7D1",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 20,
              }}
            >
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text style={{ color: "#7A3A50", fontWeight: "600" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const d = tempDate || dateObj;
                  setDateObj(d);
                  const iso = d.toISOString().slice(0, 10);
                  setVisitedAt(iso);
                  setShowDatePicker(false);
                }}
              >
                <Text style={{ color: "#7A3A50", fontWeight: "700" }}>
                  Done
                </Text>
              </Pressable>
            </View>

            {/* Inline Calendar */}
            <View
              style={{
                paddingHorizontal: 10,
                paddingTop: 12,
                paddingBottom: 20,
                backgroundColor: "FFE4EF",
                marginTop: 10,
                marginHorizontal: 12,
                borderRadius: 18,
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <DateTimePicker
                value={tempDate || dateObj}
                mode="date"
                display="inline"
                onChange={(event, selectedDate) => {
                  if (!selectedDate) return;
                  setTempDate(selectedDate);
                }}
                style={{
                  backgroundColor: "#ebbcd4ff",
                  width: "100%",
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
