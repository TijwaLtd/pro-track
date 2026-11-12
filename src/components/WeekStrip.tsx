import { format, isToday } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { weekDatesContaining } from '../domain/dates';
import { colors, radii, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';

export interface WeekDayInfo {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  weekday: string;
  isToday: boolean;
  /** project colour keys with open items due this day */
  dotColors: string[];
}

interface WeekStripProps {
  days: WeekDayInfo[];
  selected: string;
  onSelect: (date: string) => void;
}

export function buildWeekDays(selected: Date, weekStart: 0 | 1, itemsByDate: Map<string, string[]>): WeekDayInfo[] {
  return weekDatesContaining(selected, weekStart).map((d) => {
    const date = new Date(`${d}T12:00:00`);
    return {
      date: d,
      dayNumber: date.getDate(),
      weekday: format(date, 'EEE'),
      isToday: isToday(date),
      dotColors: itemsByDate.get(d) ?? [],
    };
  });
}

/** Horizontal 7-day strip per design/home.json weekStrip. */
export function WeekStrip({ days, selected, onSelect }: WeekStripProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((d) => {
        const isSelected = d.date === selected;
        const numberColor = d.isToday ? colors.accent : isSelected ? colors.textPrimary : colors.textPrimary;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="button"
            accessibilityLabel={`${d.weekday} ${d.dayNumber}, ${d.dotColors.length} projects due`}
            style={[styles.cell, isSelected && styles.cellSelected]}
          >
            <AppText type="heading" color={numberColor as never} style={d.isToday && !isSelected ? { color: colors.accent } : undefined}>
              {d.dayNumber}
            </AppText>
            <AppText type="caption" color="textTertiary">
              {d.weekday}
            </AppText>
            <View style={styles.dots}>
              {d.dotColors.slice(0, 3).map((c, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: c }]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  cell: {
    minWidth: 44,
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellSelected: { backgroundColor: colors.surfaceMuted },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
