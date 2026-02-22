// app/post/[id].tsx
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const colors = {
  bg: "#FFE4ED",
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
  place_name: string | null;
  address: string | null;
  visited_at: string | null;
  body: string | null;
  lat: number | null;
  lng: number | null;
  cover_url?: string | null;
  keyword?: string | null;
  author_id: string | null;
};

type MediaItem = {
  id: string;
  url: string;
};

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [post, setPost] = useState<Post | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ full-screen viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);

  const openImageViewer = (uri: string) => {
    setViewerImageUri(uri);
    setImageViewerVisible(true);
  };

  const closeImageViewer = () => {
    setImageViewerVisible(false);
    setViewerImageUri(null);
  };

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);

        // 1) Post
        const { data: postData, error: postErr } = await supabase
          .from("posts")
          .select(
            "id, title, place_name, address, visited_at, body, lat, lng, cover_url, keyword, author_id"
          )
          .eq("id", id)
          .single();

        if (postErr) throw postErr;
        const p = postData as Post;
        setPost(p);

        // 2) Photos for this post
        const { data: mediaData, error: mediaErr } = await supabase
          .from("media")
          .select("id, url")
          .eq("post_id", id);

        if (mediaErr) throw mediaErr;

        setPhotos((mediaData || []) as MediaItem[]);
      } catch (e) {
        console.log("load post error:", e);
        Alert.alert("Σφάλμα", "Δεν βρέθηκε αυτή η ανάμνηση.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (!id) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
        edges={["top", "left", "right"]}
      >
        <StatusBar style="light" backgroundColor={colors.accent} />
        <Text>Δεν δόθηκε id…</Text>
      </SafeAreaView>
    );
  }

  const coverUrl = post?.cover_url
    ? supabase.storage.from("photos").getPublicUrl(post.cover_url).data
        .publicUrl
    : null;

  const region: Region | null =
    post?.lat != null && post?.lng != null
      ? {
          latitude: post.lat,
          longitude: post.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : null;

  // μόνο οι υπόλοιπες φωτογραφίες (χωρίς το cover)
  const extraPhotos: MediaItem[] = photos.filter(
    (m) => !post?.cover_url || m.url !== post.cover_url
  );

  const openInMaps = () => {
    if (!region) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${region.latitude},${region.longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Σφάλμα", "Δεν μπόρεσα να ανοίξω τον χάρτη.")
    );
  };

  const goToEdit = () => {
    if (!post) return;

    router.push({
      pathname: "/add",
      params: {
        id: post.id,
        name: post.title || post.place_name || "",
        address: post.address || "",
        lat: post.lat != null ? String(post.lat) : "",
        lng: post.lng != null ? String(post.lng) : "",
        keyword: post.keyword || "",
        body: post.body || "",
        visited_at: post.visited_at || "",
      },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.accent }}
      edges={["top", "left", "right"]}
    >
      {/* status bar ίδιο με το header */}
      <StatusBar style="light" backgroundColor={colors.accent} />

      {/* Header */}
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
            backgroundColor: "rgba(255,255,255,0.2)",
            borderRadius: 999,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>←</Text>
        </Pressable>

        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 18,
          }}
        >
          Να ξαναπάμε 😊
        </Text>

        <Text style={{ fontSize: 22 }}> </Text>
      </View>

      {/* Υπόλοιπο περιεχόμενο πάνω σε απαλό ροζ */}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {loading && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color={colors.accentDark} />
          </View>
        )}

        {!loading && post && (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 24,
            }}
          >
            {/* COVER CARD */}
            <View
              style={{
                borderRadius: 28,
                backgroundColor: colors.card,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {coverUrl ? (
                <Pressable onPress={() => openImageViewer(coverUrl!)}>
                  <Image
                    source={{ uri: coverUrl }}
                    style={{ width: "100%", height: 220 }}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : (
                <LinearGradient
                  colors={["#fecaca", "#fdf2f8"]}
                  style={{
                    width: "100%",
                    height: 220,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 40 }}>💗</Text>
                </LinearGradient>
              )}

              {/* gradient τίτλου στο κάτω μέρος της φωτο */}
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"]}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: "800",
                    textShadowColor: "rgba(0,0,0,0.6)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  {post.title || post.place_name || "Χωρίς τίτλο"}
                </Text>
              </LinearGradient>
            </View>

            {/* INFO CARD */}
            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 24,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              {/* place */}
              {post.place_name && (
                <View style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 14 }}>📍</Text>
                    <Text
                      style={{
                        marginLeft: 4,
                        color: colors.accentDark,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {post.place_name}
                    </Text>
                  </View>
                  {post.address && (
                    <Text
                      style={{
                        marginTop: 2,
                        color: colors.subtext,
                        fontSize: 12,
                      }}
                    >
                      {post.address}
                    </Text>
                  )}
                </View>
              )}

              {post.keyword && (
                <View
                  style={{
                    marginTop: 6,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      backgroundColor: "#fee2e2",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#be123c",
                      }}
                    >
                      #{post.keyword}
                    </Text>
                  </View>
                </View>
              )}

              {/* date chip */}
              {post.visited_at && (
                <View
                  style={{
                    marginTop: 6,
                    marginBottom: 4,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      backgroundColor: "#fee2e2",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ marginRight: 6, color: "#be123c" }}>📅</Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#be123c",
                      }}
                    >
                      Πήγαμε: {post.visited_at}
                    </Text>
                  </View>
                </View>
              )}

              {/* NOTE bubble */}
              {post.body && (
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 20,
                    backgroundColor: "#ffe4f1",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: "#fecdd3",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                    }}
                  >
                    <Text style={{ marginRight: 6 }}>💬</Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      {post.body}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* EXTRA PHOTOS GALLERY */}
            {extraPhotos.length > 0 && (
              <View
                style={{
                  marginTop: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 24,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ columnGap: 10 }}
                >
                  {extraPhotos.map((m) => {
                    const uri = supabase.storage
                      .from("photos")
                      .getPublicUrl(m.url).data.publicUrl;

                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => openImageViewer(uri)}
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: 20,
                          overflow: "hidden",
                          backgroundColor: "#fee2e2",
                        }}
                      >
                        <Image
                          source={{ uri }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* MAP CARD */}
            <View
              style={{
                marginTop: 16,
                borderRadius: 24,
                backgroundColor: colors.card,
                padding: 10,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <View
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  height: 200,
                }}
              >
                {region ? (
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={region}
                    pointerEvents="none"
                  >
                    <Marker
                      coordinate={{
                        latitude: region.latitude,
                        longitude: region.longitude,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: "#ffe4e6",
                            padding: 8,
                            borderRadius: 999,
                            borderWidth: 2,
                            borderColor: colors.accentDark,
                          }}
                        >
                          <Text style={{ fontSize: 18 }}>💗</Text>
                        </View>
                      </View>
                    </Marker>
                  </MapView>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>
                      Δεν υπάρχουν συντεταγμένες για αυτό το σημείο.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* ACTION BUTTONS */}
            <View
              style={{
                marginTop: 18,
                flexDirection: "row",
                columnGap: 12,
              }}
            >
              <Pressable
                onPress={goToEdit}
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#fecaca",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.accentDark,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  ✏️ Επεξεργασία
                </Text>
              </Pressable>

              <Pressable
                onPress={openInMaps}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={["#f973c9", "#ec4899"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    🗺 Άνοιξε Χάρτη
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ⭐ FULL-SCREEN IMAGE VIEWER */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <Pressable
          onPress={closeImageViewer}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {viewerImageUri && (
            <Image
              source={{ uri: viewerImageUri }}
              style={{
                width: "90%",
                height: "75%",
                resizeMode: "contain",
              }}
            />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
