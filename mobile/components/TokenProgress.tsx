import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

/** #9 ✓ → #10 → #11 → #12 YOU */
export function TokenProgress({ current, ahead, mine, called }: { current: number; ahead: number[]; mine: number; called: boolean }) {
  const shown = ahead.slice(-3);
  const hidden = ahead.length - shown.length;
  const node = (label: string, kind: 'done' | 'wait' | 'me', key: string) => (
    <View key={key} style={[st.node, kind === 'done' && st.done, kind === 'me' && st.me]}>
      <Text style={[st.nodeText, kind === 'done' && { color: colors.green }, kind === 'me' && { color: colors.white }]}>{label}</Text>
    </View>
  );
  const arrow = (k: string) => <Text key={k} style={st.arrow}>→</Text>;
  const parts: ReactElement[] = [];
  if (current > 0 && !called) { parts.push(node(`#${current} ✓`, 'done', 'cur')); parts.push(arrow('a0')); }
  if (hidden > 0) { parts.push(<Text key="more" style={st.more}>+{hidden}</Text>); parts.push(arrow('am')); }
  shown.forEach((n) => { parts.push(node(`#${n}`, 'wait', `w${n}`)); parts.push(arrow(`a${n}`)); });
  parts.push(node(`#${mine} YOU`, 'me', 'me'));
  return <View style={st.row}>{parts}</View>;
}
const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  node: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.greyBg },
  done: { backgroundColor: colors.greenBg }, me: { backgroundColor: colors.primary },
  nodeText: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  arrow: { color: colors.muted, fontWeight: '700' }, more: { color: colors.muted, fontWeight: '700' },
});
