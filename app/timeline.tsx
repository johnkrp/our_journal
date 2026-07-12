import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppColors, Radius, Shadows, Spacing } from "../constants/design";
import { getErrorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";

type PostItem = {
  id: string;
  title: string | null;
  place_name: string | null;
  address: string | null;
  visited_at: string | null;
  created_at: string | null;
  cover_url: string | null;
  keyword: string | null;
};

type TimelineSection = {
  key: string;
  title: string;
  data: PostItem[];
};

type SortOrder = "latest" | "oldest";

function getPostDate(post: PostItem) {
  if (post.visited_at) return new Date(`${post.visited_at}T00:00:00`);
  if (post.created_at) return new Date(post.created_at);
  return new Date(0);
}

function monthKey(post: PostItem) {
  const d = getPostDate(post);
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthLabel(post: PostItem) {
  const d = getPostDate(post);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function TimelineScreen() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [hasPhotosOnly, setHasPhotosOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: postsError } = await supabase
        .from("posts")
        .select(
          "id, title, place_name, address, visited_at, created_at, cover_url, keyword"
        )
        .order("visited_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      setPosts((data || []) as PostItem[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load timeline."));
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
      if (p.keyword?.trim()) set.add(p.keyword.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      const year = String(getPostDate(p).getFullYear());
      if (year !== "1970") set.add(year);
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const list = posts.filter((p) => {
      if (selectedKeyword && (p.keyword || "").trim() !== selectedKeyword) {
        return false;
      }
      if (selectedYear && String(getPostDate(p).getFullYear()) !== selectedYear) {
        return false;
      }
      if (hasPhotosOnly && !p.cover_url) return false;
      return true;
    });

    list.sort((a, b) => {
      const aTime = getPostDate(a).getTime();
      const bTime = getPostDate(b).getTime();
      return sortOrder === "latest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [posts, selectedKeyword, selectedYear, hasPhotosOnly, sortOrder]);

  const sections = useMemo<TimelineSection[]>(() => {
    const map = new Map<string, TimelineSection>();
    filteredPosts.forEach((post) => {
      const key = monthKey(post);
      const section = map.get(key);
      if (section) {
        section.data.push(post);
      } else {
        map.set(key, {
          key,
          title: monthLabel(post),
          data: [post],
        });
      }
    });

    const sortFactor = sortOrder === "latest" ? -1 : 1;
    return Array.from(map.values()).sort((a, b) =>
      a.key.localeCompare(b.key) * sortFactor
    );
  }, [filteredPosts, sortOrder]);

  const currentMonthCount = useMemo(() => {
    const now = new Date();
    return posts.filter((p) => {
      const d = getPostDate(p);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [posts]);

  const topKeyword = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      const k = p.keyword?.trim();
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    let top: string | null = null;
    let max = 0;
    counts.forEach((count, key) => {
      if (count > max) {
        max = count;
        top = key;
      }
    });
    return top ? `#${top}` : "None yet";
  }, [posts]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: AppColors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: Spacing.md,
              paddingVertical: 6,
              borderRadius: Radius.pill,
              backgroundColor: "#fee2e2",
            }}
          >
            <Text style={{ color: AppColors.accentDark, fontWeight: "700" }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: "800", color: AppColors.accentDark }}>
            Timeline
          </Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={{ flexDirection: "row", marginTop: Spacing.md, gap: Spacing.sm }}>
          <View
            style={{
              flex: 1,
              backgroundColor: AppColors.card,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: AppColors.border,
              ...Shadows.soft,
            }}
          >
            <Text style={{ fontSize: 12, color: AppColors.subtext }}>This month</Text>
            <Text style={{ marginTop: 2, fontSize: 20, fontWeight: "800", color: AppColors.text }}>
              {currentMonthCount}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: AppColors.card,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: AppColors.border,
              ...Shadows.soft,
            }}
          >
            <Text style={{ fontSize: 12, color: AppColors.subtext }}>Top keyword</Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 16,
                fontWeight: "800",
                color: AppColors.accentDark,
              }}
              numberOfLines={1}
            >
              {topKeyword}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          columnGap: Spacing.sm,
        }}
      >
        <Pressable
          onPress={() => setSortOrder((prev) => (prev === "latest" ? "oldest" : "latest"))}
          style={{
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: AppColors.border,
            backgroundColor: AppColors.card,
          }}
        >
          <Text style={{ color: AppColors.text, fontWeight: "700" }}>
            Sort: {sortOrder === "latest" ? "Latest" : "Oldest"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setHasPhotosOnly((p) => !p)}
          style={{
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: hasPhotosOnly ? AppColors.accentDark : AppColors.border,
            backgroundColor: hasPhotosOnly ? "#fce7f3" : AppColors.card,
          }}
        >
          <Text
            style={{
              color: hasPhotosOnly ? AppColors.accentDark : AppColors.text,
              fontWeight: "700",
            }}
          >
            With photos
          </Text>
        </Pressable>

        {availableYears.map((year) => {
          const active = selectedYear === year;
          return (
            <Pressable
              key={year}
              onPress={() => setSelectedYear(active ? null : year)}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: 6,
                borderRadius: Radius.pill,
                borderWidth: 1,
                borderColor: active ? AppColors.accentDark : AppColors.border,
                backgroundColor: active ? "#fce7f3" : AppColors.card,
              }}
            >
              <Text
                style={{
                  color: active ? AppColors.accentDark : AppColors.text,
                  fontWeight: "700",
                }}
              >
                {year}
              </Text>
            </Pressable>
          );
        })}

        {availableKeywords.map((keyword) => {
          const active = selectedKeyword === keyword;
          return (
            <Pressable
              key={keyword}
              onPress={() => setSelectedKeyword(active ? null : keyword)}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: 6,
                borderRadius: Radius.pill,
                borderWidth: 1,
                borderColor: active ? AppColors.accentDark : AppColors.border,
                backgroundColor: active ? "#fce7f3" : AppColors.card,
              }}
            >
              <Text
                style={{
                  color: active ? AppColors.accentDark : AppColors.text,
                  fontWeight: "700",
                }}
              >
                #{keyword}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => {
            setSelectedKeyword(null);
            setSelectedYear(null);
            setHasPhotosOnly(false);
            setSortOrder("latest");
          }}
          style={{
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: AppColors.border,
            backgroundColor: "#fef2f2",
          }}
        >
          <Text style={{ color: AppColors.danger, fontWeight: "700" }}>Reset</Text>
        </Pressable>
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={AppColors.accentDark} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg }}>
          <Text style={{ color: AppColors.danger }}>{error}</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg }}>
          <Text style={{ color: AppColors.subtext, textAlign: "center" }}>
            No memories match the selected filters.
          </Text>
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, paddingBottom: 36 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <Text
              style={{
                marginTop: Spacing.md,
                marginBottom: Spacing.sm,
                fontSize: 16,
                fontWeight: "800",
                color: AppColors.accentDark,
              }}
            >
              {title}
            </Text>
          )}
          renderItem={({ item }) => {
            const thumbUrl = item.cover_url
              ? supabase.storage.from("photos").getPublicUrl(item.cover_url).data.publicUrl
              : null;

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/post/[id]",
                    params: { id: item.id },
                  })
                }
                style={{
                  marginBottom: Spacing.sm,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: AppColors.border,
                  backgroundColor: AppColors.card,
                  overflow: "hidden",
                  ...Shadows.card,
                }}
              >
                <View style={{ flexDirection: "row" }}>
                  {thumbUrl ? (
                    <Image
                      source={{ uri: thumbUrl }}
                      style={{ width: 100, height: 100 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 100,
                        height: 100,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fee2e2",
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>💗</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, padding: Spacing.md }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: AppColors.text }} numberOfLines={1}>
                      {item.title || item.place_name || "Untitled memory"}
                    </Text>
                    {!!item.place_name && (
                      <Text style={{ marginTop: 2, fontSize: 12, color: AppColors.subtext }} numberOfLines={1}>
                        {item.place_name}
                      </Text>
                    )}
                    <View style={{ marginTop: Spacing.sm, flexDirection: "row", gap: Spacing.sm }}>
                      {item.visited_at && (
                        <View
                          style={{
                            borderRadius: Radius.pill,
                            backgroundColor: "#fee2e2",
                            paddingHorizontal: Spacing.sm,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: AppColors.accentDark }}>
                            {item.visited_at}
                          </Text>
                        </View>
                      )}
                      {item.keyword && (
                        <View
                          style={{
                            borderRadius: Radius.pill,
                            backgroundColor: "#fce7f3",
                            paddingHorizontal: Spacing.sm,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: AppColors.accentDark }}>
                            #{item.keyword}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
