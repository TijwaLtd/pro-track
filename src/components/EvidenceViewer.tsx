import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { removeEvidence } from '../db/repositories/payments';
import type { Payment, PaymentEvidence } from '../db/types';
import { evidenceFileExists, resolveEvidenceUri } from '../features/evidence/files';
import { colors, radii, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';

interface EvidenceViewerProps {
  visible: boolean;
  payment: Payment | null;
  evidence: PaymentEvidence[];
  startIndex?: number;
  onClose: () => void;
  onRemoved?: () => void;
}

function fmtSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Full-screen evidence viewer per design/sheets.json#evidenceViewer. */
export function EvidenceViewer(props: EvidenceViewerProps) {
  if (!props.visible || !props.payment) return null;
  // Inner mounts fresh on each open, so index/uri state starts clean.
  return <EvidenceViewerInner key={`${props.payment.id}:${props.startIndex ?? 0}`} {...props} payment={props.payment} />;
}

function EvidenceViewerInner({
  payment,
  evidence,
  startIndex = 0,
  onClose,
  onRemoved,
}: EvidenceViewerProps & { payment: Payment }) {
  const [index, setIndex] = useState(startIndex);
  const [resolved, setResolved] = useState<{ id: string; uri: string | null; missing: boolean } | null>(null);

  const current: PaymentEvidence | undefined = evidence[index];
  const total = evidence.length;
  const uri = resolved?.id === current?.id ? resolved.uri : null;
  const missing = resolved?.id === current?.id ? resolved.missing : false;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    void (async () => {
      let result: { uri: string | null; missing: boolean };
      if (!current.relative_path) {
        result = { uri: null, missing: true };
      } else {
        const exists = await evidenceFileExists(current.relative_path);
        const resolvedUri = exists ? await resolveEvidenceUri(current.relative_path) : null;
        result = { uri: resolvedUri, missing: !resolvedUri };
      }
      if (!cancelled) setResolved({ id: current.id, ...result });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.relative_path]);

  if (!current) return null;

  const isImage = current.evidence_type === 'image' && uri;

  const share = async () => {
    if (!uri) return;
    const available = await Sharing.isAvailableAsync().catch(() => false);
    if (!available) return;
    await Sharing.shareAsync(uri, {
      mimeType: current.mime_type ?? undefined,
      dialogTitle: current.original_filename ?? 'Evidence',
    }).catch(() => {});
  };

  const remove = () => {
    const lastOne = total <= 1;
    Alert.alert(
      'Remove evidence?',
      lastOne ? 'This is the only evidence on this payment.' : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeEvidence(current.id);
            onRemoved?.();
            if (total <= 1) onClose();
            else setIndex((i) => Math.max(0, i - 1));
          },
        },
      ],
    );
  };

  return (
    <Modal visible={true} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* header */}
        <SafeAreaView edges={['top']} style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.headerBtn}>
            <AppText type="heading" color="#FFFFFF">✕</AppText>
          </Pressable>
          <AppText type="label" color="#FFFFFF">{index + 1} of {total}</AppText>
          <Pressable onPress={() => void share()} disabled={!uri} accessibilityRole="button" accessibilityLabel="Share" style={styles.headerBtn}>
            <AppText type="heading" color={uri ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}>↗</AppText>
          </Pressable>
        </SafeAreaView>

        {/* body */}
        <View style={styles.body}>
          {missing ? (
            <View style={styles.missing}>
              <AppText type="heading" color="#FFFFFF">File missing</AppText>
              <AppText type="body" color="rgba(255,255,255,0.7)">
                {current.original_filename ?? 'Unknown file'}
                {current.created_at ? ` · added ${fmtDate(current.created_at)}` : ''}
              </AppText>
            </View>
          ) : isImage ? (
            <Image source={{ uri: uri! }} style={styles.image} resizeMode="contain" accessibilityLabel={current.original_filename ?? 'Evidence image'} />
          ) : uri ? (
            <View style={styles.docWrap}>
              <AppText style={{ fontSize: 56 }}>📄</AppText>
              <AppText type="heading" color="#FFFFFF">{current.original_filename ?? 'Document'}</AppText>
              <AppText type="body" color="rgba(255,255,255,0.7)">
                {current.evidence_type.toUpperCase()}
                {current.byte_size ? ` · ${fmtSize(current.byte_size)}` : ''}
              </AppText>
              <Pressable onPress={() => void share()} style={styles.openBtn} accessibilityRole="button">
                <AppText type="label" color={colors.onAccent}>Open / share</AppText>
              </Pressable>
            </View>
          ) : (
            <AppText type="body" color="rgba(255,255,255,0.6)">Loading…</AppText>
          )}
        </View>

        {/* footer */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <AppText type="caption" color="rgba(255,255,255,0.6)" style={{ flex: 1 }} numberOfLines={1}>
            {[current.original_filename, fmtSize(current.byte_size), current.created_at ? `added ${fmtDate(current.created_at)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          {total > 1 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous"
                style={[styles.pagerBtn, index === 0 && { opacity: 0.3 }]}
              >
                <AppText type="heading" color="#FFFFFF">‹</AppText>
              </Pressable>
              <Pressable
                onPress={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index === total - 1}
                accessibilityRole="button"
                accessibilityLabel="Next"
                style={[styles.pagerBtn, index === total - 1 && { opacity: 0.3 }]}
              >
                <AppText type="heading" color="#FFFFFF">›</AppText>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Remove evidence">
            <AppText type="label" color={colors.danger}>Remove</AppText>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111114' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  image: { width: '100%', height: '100%' },
  missing: { alignItems: 'center', gap: spacing.sm },
  docWrap: { alignItems: 'center', gap: spacing.sm },
  openBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pager: { flexDirection: 'row', gap: spacing.xs },
  pagerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
