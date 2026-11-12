import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { FloatingBottomBar } from '@/components/FloatingBottomBar';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ProjectRow } from '@/components/ProjectRow';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AppText } from '@/components/ui/Text';
import { WeekStrip } from '@/components/WeekStrip';
import { archiveProject } from '@/db/repositories/projects';
import type { ProjectStatus } from '@/db/types';
import { todayLocalDate } from '@/domain/dates';
import { useHomeData } from '@/features/home/useHomeData';
import { useChatFormStore } from '@/store/chatForm';
import { colors, spacing } from '@/theme/tokens';

const FILTERS: { label: string; value: ProjectStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'On hold', value: 'on_hold' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
];

export default function HomeScreen() {
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [filter, setFilter] = useState<ProjectStatus>('active');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openForm = useChatFormStore((s) => s.openForm);

  const { loading, weekDays, heroItems, projects, reload } = useHomeData(filter, selectedDate);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.project.name.toLowerCase().includes(q));
  }, [projects, query]);

  const openNewProject = () =>
    openForm('newProject', { firstRunProject: projects.length === 0 }, {
      firstRun: projects.length === 0,
      onResult: (result) => {
        reload();
        const projectId = result?.payload?.projectId;
        if (typeof projectId === 'string') router.push(`/project/${projectId}` as never);
      },
    });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandMark size={30} />
              <AppText type="title" color="accent" style={styles.wordmark}>ProTrack</AppText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setSearchOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Search projects"
                style={styles.iconBtn}
              >
                <AppText type="heading" color="textPrimary">⌕</AppText>
              </Pressable>
              <Pressable
                onPress={() => setSettingsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={styles.iconBtn}
              >
                <AppText type="heading" color="textPrimary">⚙</AppText>
              </Pressable>
            </View>
          </View>

          {searchOpen ? (
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              accessibilityLabel="Search projects"
            />
          ) : null}

          {/* week strip */}
          <View style={styles.section}>
            <WeekStrip days={weekDays} selected={selectedDate} onSelect={setSelectedDate} />
          </View>

          {/* hero carousel */}
          <View style={styles.section}>
            <HeroCarousel
              items={heroItems}
              onPressItem={(id) => router.push(`/item/${id}` as never)}
              emptyAction={openNewProject}
            />
          </View>

          {/* projects header */}
          <View style={styles.projectsHeader}>
            <AppText type="heading">Projects</AppText>
            <Pressable
              onPress={() => setFilterOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Filter projects"
              style={styles.filterBtn}
            >
              <AppText type="label" color="textSecondary">
                {FILTERS.find((f) => f.value === filter)?.label} ▾
              </AppText>
            </Pressable>
          </View>
          {filterOpen ? (
            <View style={styles.filterMenu}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => {
                    setFilter(f.value);
                    setFilterOpen(false);
                  }}
                  style={styles.filterOption}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === f.value }}
                >
                  <AppText type="body" color={filter === f.value ? 'accent' : 'textPrimary'}>{f.label}</AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* project list */}
          {loading ? (
            <AppText type="body" color="textSecondary" style={styles.loading}>Loading…</AppText>
          ) : visibleProjects.length === 0 ? (
            <View style={styles.empty}>
              <AppText type="heading">No projects yet</AppText>
              <AppText type="body" color="textSecondary">Create your first project and pick a colour.</AppText>
              <Pressable onPress={openNewProject} accessibilityRole="button" style={styles.emptyBtn}>
                <AppText type="label" color={colors.accent}>Start my first project</AppText>
              </Pressable>
            </View>
          ) : (
            visibleProjects.map((p) => (
              <ProjectRow
                key={p.project.id}
                data={p}
                onPress={() => router.push(`/project/${p.project.id}` as never)}
                onLongPress={() =>
                  Alert.alert(p.project.name, undefined, [
                    { text: 'Archive', style: 'destructive', onPress: () => { archiveProject(p.project.id); reload(); } },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <FloatingBottomBar onAdd={openNewProject} onSettings={() => setSettingsOpen(true)} />
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} onChanged={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { paddingBottom: 112 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { fontFamily: 'Inter_700Bold' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
  },
  section: { marginTop: spacing.lg },
  projectsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.huge,
  },
  filterBtn: { paddingVertical: spacing.xs },
  filterMenu: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterOption: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  loading: { textAlign: 'center', marginTop: spacing.xl },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  emptyBtn: { marginTop: spacing.sm },
});
