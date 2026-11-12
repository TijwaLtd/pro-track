import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './ui/Text';
import { DecorativeArt } from './DecorativeArt';
import { colors, radii, spacing } from '../theme/tokens';
import { getProjectColor, onColorFor } from '../theme/projectColor';
import { formatMoney } from '../domain/money';
import { formatDueDate } from '../domain/dates';
import type { Project } from '../db/types';
import type { CurrencyTotals } from '../db/derived';

export interface ProjectRowData {
  project: Project;
  done: number;
  eligible: number;
  nextDue: string | null;
  outstandingMinor: number;
  currency: string | null;
  totals: Map<string, CurrencyTotals>;
}

interface ProjectRowProps {
  data: ProjectRowData;
  onPress: () => void;
  onLongPress?: () => void;
}

/** Project list row per design/home.json projectList.row. */
export function ProjectRow({ data, onPress, onLongPress }: ProjectRowProps) {
  const { project } = data;
  const color = getProjectColor(project.color_key);
  const onColor = onColorFor(color);
  const progress = data.eligible > 0 ? data.done / data.eligible : 0;
  const single = data.currency;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${data.done} of ${data.eligible} items done${data.outstandingMinor > 0 ? `, ${formatMoney(data.outstandingMinor, single ?? project.currency_code)} outstanding` : ''}`}
      style={styles.row}
    >
      {/* project colour tile with miniature decorative art + initial */}
      <View style={[styles.thumb, { backgroundColor: color.hex }]}>
        <DecorativeArt seed={project.id} colorKey={project.color_key} variant="list" />
        <AppText type="heading" color={onColor as never} style={styles.initial}>
          {project.name.charAt(0).toUpperCase()}
        </AppText>
      </View>
      <View style={styles.body}>
        <AppText type="heading" numberOfLines={1}>{project.name}</AppText>
        <AppText type="caption" color="textSecondary">
          {data.done} of {data.eligible} done{data.nextDue ? ` · next ${formatDueDate(data.nextDue)}` : ''}
        </AppText>
        {data.eligible > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: color.hex, width: `${Math.round(progress * 100)}%` as never }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {data.outstandingMinor > 0 && single ? (
          <AppText type="label" color="danger">{formatMoney(data.outstandingMinor, single)}</AppText>
        ) : null}
        <AppText color="textTertiary">›</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 76,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { zIndex: 1 },
  body: { flex: 1, gap: 2 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
