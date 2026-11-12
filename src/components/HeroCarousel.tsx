import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { PaymentStatus } from '../db/types';
import { formatDueTime } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { colors, radii, spacing } from '../theme/tokens';
import { AvatarBadge } from './AvatarBadge';
import { DecorativeArt } from './DecorativeArt';
import { AppText } from './ui/Text';

export interface HeroItem {
  itemId: string;
  projectId: string;
  title: string;
  avatarKey: string;
  dueTime: string | null;
  expectedMinor: number | null;
  currency: string;
  paymentStatus: PaymentStatus | null;
  projectName: string;
  colorKey: string;
  colorHex: string;
  onColor: string;
  priority?: string;
  nextUpLabel?: string | null;
}

interface HeroCarouselProps {
  items: HeroItem[];
  onPressItem: (itemId: string) => void;
  emptyAction: () => void;
}

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
  not_applicable: 'No cost',
};

/** Featured card carousel per design/home.json heroCard. */
export function HeroCarousel({ items, onPressItem, emptyAction }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <AppText type="heading" color="textPrimary">Nothing scheduled</AppText>
        <AppText type="body" color="textSecondary">Add an item to a project to see it here.</AppText>
        <Pressable onPress={emptyAction} accessibilityRole="button" style={styles.emptyAction}>
          <AppText type="label" color={colors.accent}>Start my first project</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* snap carousel: centred card with a peek of the neighbours */}
      <ScrollViewWrapper
        items={items}
        onPressItem={onPressItem}
        onActiveChange={setActiveIndex}
      />
      {items.length > 1 ? (
        <View style={styles.dotsRow}>
          {items.map((_, i) => (
            <View key={i} style={[styles.pageDot, i === activeIndex && styles.pageDotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}


function ScrollViewWrapper({
  items,
  onPressItem,
  onActiveChange,
}: {
  items: HeroItem[];
  onPressItem: (id: string) => void;
  onActiveChange: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const gap = spacing.md;
  const slideW = Math.round(width * 0.78);
  const sidePad = (width - slideW) / 2;
  const interval = slideW + gap;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={interval}
      snapToAlignment="start"
      disableIntervalMomentum
      contentContainerStyle={{ paddingHorizontal: sidePad }}
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / interval);
        onActiveChange(Math.max(0, Math.min(items.length - 1, i)));
      }}
    >
      {items.map((h, idx) => (
        <Pressable
          key={h.itemId}
          onPress={() => onPressItem(h.itemId)}
          accessibilityRole="button"
          accessibilityLabel={`${h.title}, ${h.projectName}, due ${h.dueTime ?? 'all day'}`}
          style={[
            styles.card,
            {
              width: slideW,
              backgroundColor: h.colorHex,
              marginRight: idx < items.length - 1 ? gap : 0,
            },
          ]}
        >
          <DecorativeArt seed={h.projectId} colorKey={h.colorKey} variant="hero" />
          <View style={styles.slideContent}>
            <View style={styles.topRow}>
              <View style={styles.projectChip}>
                <AppText type="caption" color={h.onColor}>{h.projectName}</AppText>
              </View>
              {h.priority === 'high' || h.priority === 'urgent' ? (
                <View style={[styles.projectChip, styles.priorityChip]}>
                  <AppText type="caption" color={h.onColor}>{h.priority}</AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.centre}>
              {h.nextUpLabel ? (
                <AppText type="caption" color={h.onColor} style={{ opacity: 0.85 }}>{h.nextUpLabel}</AppText>
              ) : null}
              <AvatarBadge avatarKey={h.avatarKey} projectColor={h.colorHex} size="hero" />
              <AppText type="title" color={h.onColor} numberOfLines={2} style={styles.itemTitle}>
                {h.title}
              </AppText>
            </View>
            <View style={styles.bottomRow}>
              <AppText type="label" color={h.onColor}>{h.dueTime ? formatDueTime(h.dueTime) : 'All day'}</AppText>
              {h.expectedMinor != null ? (
                <View style={styles.costBadge}>
                  <AppText type="label" color="textPrimary">
                    {formatMoney(h.expectedMinor, h.currency)}
                    {h.paymentStatus ? ` · ${PAYMENT_LABELS[h.paymentStatus]}` : ''}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  card: {
    width: '100%',
    height: 280,
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#111114',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    height: 200,
  },
  emptyAction: { marginTop: spacing.sm },
  slideContent: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  projectChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  priorityChip: { backgroundColor: 'rgba(0,0,0,0.25)' },
  centre: { alignItems: 'center', gap: spacing.md },
  itemTitle: { textAlign: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  pageDotActive: { backgroundColor: colors.textPrimary, width: 16 },
});
