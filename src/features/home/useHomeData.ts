import { useCallback, useEffect, useState } from 'react';
import type { HeroItem } from '../../components/HeroCarousel';
import type { ProjectRowData } from '../../components/ProjectRow';
import type { WeekDayInfo } from '../../components/WeekStrip';
import { buildWeekDays } from '../../components/WeekStrip';
import { itemAmounts, projectProgress, projectTotalsByCurrency, singleCurrency } from '../../db/derived';
import {
    listItemsByProject,
    listNextOpenItems,
    listOpenItemsDueBetween,
    listOpenItemsDueOn,
} from '../../db/repositories/items';
import { listPaymentsForItem } from '../../db/repositories/payments';
import { listProjects } from '../../db/repositories/projects';
import { getWeekStartPref } from '../../db/repositories/settings';
import type { Payment, ProjectItem, ProjectStatus } from '../../db/types';
import { formatDueDate, weekDatesContaining } from '../../domain/dates';
import { getProjectColor } from '../../theme/projectColor';

export interface HomeData {
  loading: boolean;
  weekDays: WeekDayInfo[];
  heroItems: HeroItem[];
  projects: ProjectRowData[];
  reload: () => void;
}

function paymentsMapFor(items: ProjectItem[]): Map<string, Payment[]> {
  const map = new Map<string, Payment[]>();
  for (const i of items) map.set(i.id, listPaymentsForItem(i.id));
  return map;
}

function toHeroItem(
  item: ProjectItem & { project_name: string; project_color_key: string },
  nextUpLabel: string | null = null,
): HeroItem {
  const color = getProjectColor(item.project_color_key);
  const amounts = itemAmounts(item, listPaymentsForItem(item.id));
  return {
    itemId: item.id,
    projectId: item.project_id,
    title: item.title,
    avatarKey: item.avatar_key,
    dueTime: item.due_time,
    expectedMinor: item.expected_amount_minor,
    currency: item.currency_code,
    paymentStatus: amounts.paymentStatus,
    projectName: item.project_name,
    colorKey: item.project_color_key,
    colorHex: color.hex,
    onColor: color.onColor,
    priority: item.priority,
    nextUpLabel,
  };
}

export function useHomeData(statusFilter: ProjectStatus | 'all', selectedDate: string): HomeData {
  const [loading, setLoading] = useState(true);
  const [weekDays, setWeekDays] = useState<WeekDayInfo[]>([]);
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [projects, setProjects] = useState<ProjectRowData[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      try {
      const ws: 0 | 1 = getWeekStartPref() === 'sunday' ? 0 : 1;

      const weekDates = weekDatesContaining(new Date(), ws);
      const dots = new Map<string, string[]>();
      for (const row of listOpenItemsDueBetween(weekDates[0], weekDates[weekDates.length - 1])) {
        const hex = getProjectColor(row.project_color_key).hex;
        const arr = dots.get(row.due_date!) ?? [];
        if (!arr.includes(hex)) arr.push(hex);
        dots.set(row.due_date!, arr);
      }
      setWeekDays(buildWeekDays(new Date(), ws, dots));

      const dueOnDate = listOpenItemsDueOn(selectedDate).map((i) => toHeroItem(i));
      if (dueOnDate.length > 0) {
        setHeroItems(dueOnDate);
      } else {
        setHeroItems(
          listNextOpenItems(selectedDate, 3).map((i) =>
            toHeroItem(i, `NEXT UP · ${formatDueDate(i.due_date)}`),
          ),
        );
      }

      const rows: ProjectRowData[] = listProjects(
        statusFilter === 'all' ? 'non_archived' : statusFilter,
      ).map((project) => {
        const items = listItemsByProject(project.id);
        const progress = projectProgress(items);
        const nextItem = items
          .filter(
            (i) =>
              i.due_date &&
              i.completion_status !== 'completed' &&
              i.completion_status !== 'cancelled',
          )
          .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
        const totals = projectTotalsByCurrency(items, paymentsMapFor(items));
        const cur = singleCurrency(items);
        const t = cur ? totals.get(cur) : undefined;
        return {
          project,
          done: progress.done,
          eligible: progress.eligible,
          nextDue: nextItem?.due_date ?? null,
          outstandingMinor: t?.outstandingMinor ?? 0,
          currency: cur,
          totals,
        };
      });
      setProjects(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [statusFilter, selectedDate, tick]);

  return { loading, weekDays, heroItems, projects, reload };
}
