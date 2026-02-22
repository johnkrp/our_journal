// app/index.tsx
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY!;

const colors = {
  bg: "#FFF1F2",
  card: "#FFFFFF",
  accent: "#ec4899",
  accentDark: "#be185d",
  text: "#111827",
  subtext: "#6b7280",
  border: "#f5d0ea",
};

type Place = {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
};

type Post = {
  id: string;
  title: string | null;
  place_name: string | null;
  address: string | null;
  visited_at: string | null;
  cover_url?: string | null;
  keyword?: string | null;
};

type MemoryPin = {
  id: string;
  title: string | null;
  place_name: string | null;
  lat: number;
  lng: number;
};

type DreamPin = {
  id: string;
  place_name: string | null;
  lat: number;
  lng: number;
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [region, setRegion] = useState<Region>({
    latitude: 37.9838, // Athens
    longitude: 23.7275,
    latitudeDelta: 0.4,
    longitudeDelta: 0.4,
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);

  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [memoriesCount, setMemoriesCount] = useState(0);
  const [dreamsCount, setDreamsCount] = useState(0);

  const [memoryPins, setMemoryPins] = useState<MemoryPin[]>([]);
  const [dreamPins, setDreamPins] = useState<DreamPin[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // ⭐ ΝΕΑ state για keywords των dreams
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedDreamKeyword, setSelectedDreamKeyword] = useState<
    string | null
  >(null);

  // animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;
  const recentAnim = useRef(new Animated.Value(0)).current;
  const galleryAnim = useRef(new Animated.Value(1)).current;

  // Ζήτα άδεια & πήγαινε στο user location
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        const r: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 600);
      } catch (e) {
        console.log("Location error:", e);
      }
    })();
  }, []);

  // start animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 450,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mapAnim, {
        toValue: 1,
        duration: 450,
        delay: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(recentAnim, {
        toValue: 1,
        duration: 450,
        delay: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // όταν αλλάζουν τα posts, γύρνα την gallery στην αρχή
  useEffect(() => {
    if (recentPosts.length) {
      setGalleryIndex(0);
    }
  }, [recentPosts.length]);

  // auto-slide κάθε 5 δευτερόλεπτα, 2-2 με animation
  useEffect(() => {
    if (recentPosts.length <= 2) return;

    const id = setInterval(() => {
      // ξεκίνα το animation (ελαφρύ zoom + fade)
      galleryAnim.setValue(0.85);
      Animated.timing(galleryAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // και άλλαξε το index
      setGalleryIndex((prev) => {
        const len = recentPosts.length;
        if (len === 0) return 0;
        return (prev + 2) % len;
      });
    }, 5000);

    return () => clearInterval(id);
  }, [recentPosts.length, galleryAnim]);

  const handleChangeQuery = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setSelected(null);
      setSelectedDreamKeyword(null); // reset keyword όταν αδειάζει η αναζήτηση
    }
  };

  const loadRecentPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, title, place_name, address, visited_at, cover_url, keyword"
        )
        .order("visited_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const arr = (data || []) as Post[];
      setRecentPosts(arr);
    } catch (e) {
      console.log("recent posts error:", e);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const loadMapPins = useCallback(async () => {
    try {
      // MEMORIES με lat/lng
      const { data: postsData, error: postsErr } = await supabase
        .from("posts")
        .select("id, title, place_name, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (!postsErr && postsData) {
        const pins: MemoryPin[] = postsData.map((p: any) => ({
          id: p.id,
          title: p.title,
          place_name: p.place_name,
          lat: p.lat,
          lng: p.lng,
        }));
        setMemoryPins(pins);
      }

      // DREAMS με lat/lng
      const { data: dreamsData, error: dreamsErr } = await supabase
        .from("dreams")
        .select("id, place_name, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (!dreamsErr && dreamsData) {
        const pins: DreamPin[] = dreamsData.map((d: any) => ({
          id: d.id,
          place_name: d.place_name,
          lat: d.lat,
          lng: d.lng,
        }));
        setDreamPins(pins);
      }
    } catch (e) {
      console.log("loadMapPins error:", e);
    }
  }, []);

  // ⭐ ΝΕΟ: load όλων των υπαρχόντων keywords από posts + dreams
  const loadKeywords = useCallback(async () => {
    try {
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
      console.log("loadKeywords error:", e);
    }
  }, []);

  // Φόρτωσε counts (memories & dreams) από τη βάση
  const loadCounts = useCallback(async () => {
    try {
      const { count: postsCount, error: postsErr } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true });

      if (!postsErr && typeof postsCount === "number") {
        setMemoriesCount(postsCount);
      }

      const { count: dreamsCnt, error: dreamsErr } = await supabase
        .from("dreams")
        .select("id", { count: "exact", head: true });

      if (!dreamsErr && typeof dreamsCnt === "number") {
        setDreamsCount(dreamsCnt);
      }
    } catch (e) {
      console.log("loadCounts error:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentPosts();
      loadCounts();
      loadMapPins();
      loadKeywords(); // ⭐ Φόρτωσε και τα keywords
    }, [loadRecentPosts, loadCounts, loadMapPins, loadKeywords])
  );

  const searchPlaces = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        query
      )}&location=${region.latitude},${
        region.longitude
      }&radius=4000&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const items: Place[] = json.results || [];
      setResults(items);
      if (items.length) {
        const p = items[0];
        setSelected(p);
        setSelectedDreamKeyword(null); // reset επιλογή keyword σε νέο point
        mapRef.current?.animateToRegion(
          {
            latitude: p.geometry.location.lat,
            longitude: p.geometry.location.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          500
        );
      }
    } catch (e) {
      console.log("Places error:", e);
    }
  };

  const openCreatePost = () => {
    if (!selected) return;
    const p = selected;
    router.push({
      pathname: "/add",
      params: {
        name: p.name,
        address: p.formatted_address || "",
        lat: String(p.geometry.location.lat),
        lng: String(p.geometry.location.lng),
        keyword: selectedDreamKeyword ?? "",
      },
    });
  };

  const addToDreams = async () => {
    if (!selected) return;

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = userData.user;
      if (!user) throw new Error("Δεν είσαι συνδεδεμένος.");

      const { error: profErr } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.email ?? "user",
      });
      if (profErr) throw profErr;

      const { error } = await supabase.from("dreams").insert({
        author_id: user.id,
        place_name: selected.name,
        address: selected.formatted_address ?? "",
        lat: selected.geometry.location.lat,
        lng: selected.geometry.location.lng,
        note: null,
        keyword: selectedDreamKeyword ?? null, // ⭐ αποθήκευση keyword
      });

      if (error) throw error;

      setDreamsCount((prev) => prev + 1);
      Alert.alert("Αποθηκεύτηκε!", "Την άλλη φορά εκεί να πάμε 😁");
      setSelectedDreamKeyword(null);
      setSelected(null);
      setResults([]);
      setQuery("");
    } catch (e: any) {
      console.log("ADD DREAM ERROR:", e);
      Alert.alert("Error", e?.message || "Κάτι πήγε στραβά.");
    }
  };

  // 2-θέσιο window πάνω στα recentPosts
  const visibleGalleryPosts = React.useMemo(() => {
    const len = recentPosts.length;
    if (len <= 2) return recentPosts;

    const arr: Post[] = [];
    for (let i = 0; i < 2; i++) {
      arr.push(recentPosts[(galleryIndex + i) % len]);
    }
    return arr;
  }, [recentPosts, galleryIndex]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
        {/* HEADER */}
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          }}
        >
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20 }}>💗</Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  marginLeft: 6,
                  color: colors.accentDark,
                }}
              >
                Για εμάς 💗
              </Text>
            </View>
            <Text
              style={{
                color: colors.subtext,
                marginTop: 2,
                fontSize: 12,
              }}
            >
              {memoriesCount} αναμνήσεις · {dreamsCount} όνειρα
            </Text>

            <Pressable onPress={() => router.push("/dreams")}>
              <Text
                style={{
                  color: colors.accentDark,
                  fontSize: 13,
                  marginTop: 2,
                  textDecorationLine: "underline",
                }}
              >
                Πάρε ιδέες 💭
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/my-posts")}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              Οι Στιγμές μας 🥰
            </Text>
          </Pressable>
        </Animated.View>

        {/* SEARCH CARD */}
        <Animated.View
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 18,
            backgroundColor: colors.card,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            borderWidth: 1,
            borderColor: colors.border,
            opacity: searchAnim,
            transform: [
              {
                translateY: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F9FAFB",
              borderRadius: 999,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ marginRight: 8 }}>🔍</Text>

            <TextInput
              value={query}
              onChangeText={handleChangeQuery}
              placeholder="Που θες να πάμε μωρό; 🤔"
              placeholderTextColor={colors.subtext}
              onSubmitEditing={searchPlaces}
              style={{
                flex: 1,
                paddingVertical: Platform.select({ ios: 10, android: 6 }),
                fontSize: 14,
                color: colors.text,
              }}
              returnKeyType="search"
            />

            {(query.length > 0 || results.length > 0) && (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setResults([]);
                  setSelected(null);
                  setSelectedDreamKeyword(null);
                  Keyboard.dismiss();
                }}
                style={{ paddingHorizontal: 4 }}
              >
                <Text style={{ fontSize: 16 }}>✕</Text>
              </Pressable>
            )}
          </View>

          {!!results.length && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.place_id}
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: 8, maxHeight: 220 }}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: "#F3F4F6",
                    marginVertical: 4,
                  }}
                />
              )}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelected(item);
                    setSelectedDreamKeyword(null);
                    Keyboard.dismiss();
                    mapRef.current?.animateToRegion(
                      {
                        latitude: item.geometry.location.lat,
                        longitude: item.geometry.location.lng,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                      },
                      500
                    );
                  }}
                  style={{ paddingVertical: 6 }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {item.name}
                  </Text>
                  {!!item.formatted_address && (
                    <Text
                      style={{
                        color: colors.subtext,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {item.formatted_address}
                    </Text>
                  )}
                </Pressable>
              )}
            />
          )}
        </Animated.View>

        {/* MAP CARD */}
        <Animated.View
          style={{
            flex: 1,
            marginTop: 12,
            borderRadius: 22,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#E5E7EB",
            opacity: mapAnim,
            transform: [
              {
                scale: mapAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
          }}
        >
          <MapView
            ref={(r) => {
              mapRef.current = r;
            }}
            style={{ flex: 1 }}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
            showsUserLocation
          >
            {/* MEMORIES – ροζ καρδούλα 💗 */}
            {memoryPins.map((m) => (
              <Marker
                key={`mem-${m.id}`}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                onPress={() =>
                  router.push({
                    pathname: "/post/[id]",
                    params: { id: m.id },
                  })
                }
              >
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: "#ffe4e6",
                      borderRadius: 999,
                      padding: 6,
                      borderWidth: 2,
                      borderColor: "#be185d",
                      shadowColor: "#000",
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>💗</Text>
                  </View>
                </View>
              </Marker>
            ))}

            {/* DREAMS – πράσινο συννεφάκι 💭 */}
            {dreamPins.map((d) => (
              <Marker
                key={`dream-${d.id}`}
                coordinate={{ latitude: d.lat, longitude: d.lng }}
                onPress={() => {
                  router.push({
                    pathname: "/add",
                    params: {
                      name: d.place_name ?? "",
                      lat: String(d.lat),
                      lng: String(d.lng),
                    },
                  });
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor: "#dcfce7",
                      borderRadius: 999,
                      padding: 6,
                      borderWidth: 2,
                      borderColor: "#16a34a",
                      shadowColor: "#000",
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>💭</Text>
                  </View>
                </View>
              </Marker>
            ))}

            {/* SEARCH RESULTS – μπλε pin 📍 */}
            {results.map((p) => (
              <Marker
                key={p.place_id}
                coordinate={{
                  latitude: p.geometry.location.lat,
                  longitude: p.geometry.location.lng,
                }}
                onPress={() => setSelected(p)}
              >
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      backgroundColor:
                        selected && selected.place_id === p.place_id
                          ? "#bfdbfe"
                          : "#e5e7eb",
                      borderRadius: 999,
                      padding: 6,
                      borderWidth: 2,
                      borderColor:
                        selected && selected.place_id === p.place_id
                          ? "#1d4ed8"
                          : "#6b7280",
                      shadowColor: "#000",
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>📍</Text>
                  </View>
                </View>
              </Marker>
            ))}
          </MapView>
        </Animated.View>

        {/* SELECTED PLACE CARD – κάτω από τον χάρτη */}
        {selected && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: "white",
              padding: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                fontSize: 16,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {selected.name}
            </Text>
            {!!selected.formatted_address && (
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {selected.formatted_address}
              </Text>
            )}

            {/* ⭐ KEYWORD PICKER ΓΙΑ DREAM */}
            {keywords.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ columnGap: 8 }}
                >
                  {keywords.map((k) => {
                    const active = selectedDreamKeyword === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() =>
                          setSelectedDreamKeyword(active ? null : k)
                        }
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active
                            ? colors.accentDark
                            : colors.border,
                          backgroundColor: active ? "#fce7f3" : "#f9fafb",
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
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                marginTop: 10,
                gap: 8,
              }}
            >
              <Pressable
                onPress={openCreatePost}
                style={{
                  flex: 1,
                  backgroundColor: colors.accentDark,
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Πήγαμε εδώ! 🥳
                </Text>
              </Pressable>

              <Pressable
                onPress={addToDreams}
                style={{
                  flex: 1,
                  backgroundColor: "#f9a8d4",
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#9f1239",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Να το θυμόμαστε 👌
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* GALLERY SLIDESHOW: 2 κάρτες που αλλάζουν μόνες τους */}
        <Animated.View
          style={{
            marginTop: 12,
            opacity: recentAnim,
            transform: [
              {
                translateY: recentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.subtext,
              marginBottom: 6,
            }}
          >
            Τοπ βόλτες 😎
          </Text>

          {loadingPosts && !recentPosts.length ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : visibleGalleryPosts.length === 0 ? (
            <View
              style={{
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 12,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                Ακόμα δεν έχετε αναμνήσεις. Ξεκινήστε με ένα νέο μέρος 💕
              </Text>
            </View>
          ) : (
            <Animated.View
              style={{
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 8,
                paddingHorizontal: 8,
                opacity: galleryAnim,
                transform: [
                  {
                    scale: galleryAnim.interpolate({
                      inputRange: [0.85, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  columnGap: 10,
                }}
              >
                {visibleGalleryPosts.map((item) => {
                  const thumbUrl = item.cover_url
                    ? supabase.storage
                        .from("photos")
                        .getPublicUrl(item.cover_url).data.publicUrl
                    : null;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        router.push({
                          pathname: "/post/[id]",
                          params: { id: item.id },
                        })
                      }
                      style={{
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 18,
                          overflow: "hidden",
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          shadowColor: "#000",
                          shadowOpacity: 0.08,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                        }}
                      >
                        {thumbUrl ? (
                          <Image
                            source={{ uri: thumbUrl }}
                            style={{ width: "100%", height: 120 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: "100%",
                              height: 120,
                              backgroundColor: "#fee2e2",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontSize: 28 }}>💗</Text>
                          </View>
                        )}

                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "700",
                              fontSize: 13,
                              color: colors.text,
                            }}
                            numberOfLines={1}
                          >
                            {item.title || item.place_name || "Untitled"}
                          </Text>

                          {item.place_name && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.subtext,
                                marginTop: 2,
                              }}
                              numberOfLines={1}
                            >
                              {item.place_name}
                            </Text>
                          )}

                          {item.keyword && (
                            <View
                              style={{
                                marginTop: 6,
                                alignSelf: "flex-start",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: "#fce7f3",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "700",
                                  color: colors.accentDark,
                                }}
                              >
                                #{item.keyword}
                              </Text>
                            </View>
                          )}

                          {item.visited_at && (
                            <View
                              style={{
                                marginTop: 6,
                                alignSelf: "flex-start",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: "#fee2e2",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "700",
                                  color: colors.accentDark,
                                }}
                              >
                                {item.visited_at}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
