// app/my-posts.tsx
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const colors = {
  bg: "#FFF1F2",
  card: "#FFFFFF",
  accent: "#ec4899",
  accentDark: "#be185d",
  text: "#111827",
  subtext: "#6b7280",
  border: "#f5d0ea",
};

type Post = {
  id: string;
  title: string | null;
  body: string | null;
  visited_at: string | null;
  created_at: string | null;
  place_name: string | null;
  address: string | null;
  cover_url: string | null;
  keyword?: string | null;
};

type MemoryCardProps = {
  post: Post;
  onPress: () => void;
  thumbUrl: string | null;
};

const MemoryCard: React.FC<MemoryCardProps> = ({ post, onPress, thumbUrl }) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          flexDirection: "row",
          padding: 10,
          borderRadius: 20,
          backgroundColor: "#FFE4ED",
          borderWidth: 1,
          borderColor: "#FEC6D0",
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={{ width: 72, height: 72, borderRadius: 18, marginRight: 10 }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              marginRight: 10,
              backgroundColor: "#fee2e2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 26 }}>💗</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text
                style={{ fontWeight: "800", fontSize: 15, color: colors.text }}
                numberOfLines={1}
              >
                {post.title || post.place_name || "Untitled memory"}
              </Text>

              {post.place_name && (
                <Text
                  style={{ marginTop: 2, fontSize: 12, color: colors.subtext }}
                  numberOfLines={1}
                >
                  {post.place_name}
                </Text>
              )}
            </View>

            <View style={{ alignItems: "flex-end", gap: 4 }}>
              {post.visited_at && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: "#fee2e2",
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: colors.accentDark,
                    }}
                  >
                    {post.visited_at}
                  </Text>
                </View>
              )}

              {post.keyword && (
                <View
                  style={{
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
                    #{post.keyword}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {post.address && (
            <Text
              style={{ marginTop: 4, fontSize: 11, color: colors.subtext }}
              numberOfLines={1}
            >
              {post.address}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function MyPostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [keywordMenuOpen, setKeywordMenuOpen] = useState(false);

  // ✅ EXACTLY like index: one state, no debounce, no extra wrapper component
  const [searchQuery, setSearchQuery] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("visited_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts((data || []) as Post[]);
    } catch (e: any) {
      setError(e?.message || "Κάτι πήγε στραβά.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  const availableKeywords = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      const k = p.keyword?.trim();
      if (k) set.add(k);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "el"));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let list = posts;

    if (selectedKeyword) {
      list = list.filter((p) => p.keyword?.trim() === selectedKeyword);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((p) => {
        const title = (p.title || "").toLowerCase();
        const place = (p.place_name || "").toLowerCase();
        const addr = (p.address || "").toLowerCase();
        return title.includes(q) || place.includes(q) || addr.includes(q);
      });
    }

    return list;
  }, [posts, selectedKeyword, searchQuery]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.accent }}
      edges={["top", "left", "right"]}
    >
      <StatusBar style="light" backgroundColor={colors.accent} />

      {/* HEADER */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.accent,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.2)",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>←</Text>
        </Pressable>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: "#fff",
            letterSpacing: 0.5,
          }}
          numberOfLines={1}
        >
          Κοίτα που έχουμε πάει! 😍
        </Text>

        <View style={{ width: 20 }} />
      </View>

      {/* FILTER BAR (INLINE, not as nested component) */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.accent,
        }}
      >
        {/* keyword row */}
        <View
          style={{
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingHorizontal: 12,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Text style={{ color: "#fff", marginRight: 6 }}>🏷️</Text>
            <Text style={{ color: "#fff", fontSize: 13 }} numberOfLines={1}>
              Keyword:
              <Text style={{ fontWeight: "800" }}>
                {" "}
                {selectedKeyword ? `#${selectedKeyword}` : "Όλα"}
              </Text>
            </Text>
          </View>

          {availableKeywords.length > 0 && (
            <Pressable
              onPress={() => setKeywordMenuOpen((prev) => !prev)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.9)",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.accentDark,
                }}
              >
                Επιλογή
              </Text>
            </Pressable>
          )}
        </View>

        {/* ✅ SEARCH BAR (COPY/PASTE style from index) */}
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#F9FAFB",
            borderRadius: 999,
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ marginRight: 8 }}>🔍</Text>

          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!text.trim()) {
                // optional: όταν αδειάζει, κλείσε dropdown & reset keyword
                // setSelectedKeyword(null);
                setKeywordMenuOpen(false);
              }
            }}
            onFocus={() => {
              if (keywordMenuOpen) setKeywordMenuOpen(false);
            }}
            placeholder="Ψάξε με τίτλο ή μέρος..."
            placeholderTextColor={colors.subtext}
            style={{
              flex: 1,
              paddingVertical: 10, // ίδιο “feel” με index (σταθερό, όχι conditional)
              fontSize: 14,
              color: colors.text,
            }}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />

          {(searchQuery.length > 0) && (
            <Pressable
              onPress={() => {
                setSearchQuery("");
                setKeywordMenuOpen(false);
              }}
              style={{ paddingHorizontal: 4 }}
            >
              <Text style={{ fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* dropdown keywords */}
        {keywordMenuOpen && availableKeywords.length > 0 && (
          <View
            style={{
              marginTop: 8,
              borderRadius: 14,
              backgroundColor: colors.card,
              paddingVertical: 4,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => {
                setSelectedKeyword(null);
                setKeywordMenuOpen(false);
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 10 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: selectedKeyword ? colors.text : colors.accentDark,
                  fontWeight: selectedKeyword ? "400" : "700",
                }}
              >
                Όλα τα keywords
              </Text>
            </Pressable>

            {availableKeywords.map((key) => {
              const active = key === selectedKeyword;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelectedKeyword(key);
                    setKeywordMenuOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: active ? "#ffe4ef" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? colors.accentDark : colors.text,
                      fontWeight: active ? "700" : "400",
                    }}
                  >
                    #{key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* BODY */}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={colors.accent} />
            <Text style={{ marginTop: 8, color: colors.subtext }}>
              Φόρτωση αναμνήσεων...
            </Text>
          </View>
        ) : (
          <>
            {error && (
              <Text style={{ color: "crimson", padding: 16 }}>{error}</Text>
            )}

            {filteredPosts.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <Text style={{ color: colors.subtext, textAlign: "center" }}>
                  Δεν βρέθηκαν αναμνήσεις
                  {selectedKeyword ? ` με keyword #${selectedKeyword}` : ""}
                  {searchQuery.trim() ? ` για "${searchQuery.trim()}" 😭` : "."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredPosts}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  let thumbUrl: string | null = null;

                  if (item.cover_url) {
                    const path = item.cover_url.replace(/^\/+/, "");
                    thumbUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
                  }

                  return (
                    <MemoryCard
                      post={item}
                      thumbUrl={thumbUrl}
                      onPress={() =>
                        router.push({
                          pathname: "/post/[id]",
                          params: { id: item.id },
                        })
                      }
                    />
                  );
                }}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
