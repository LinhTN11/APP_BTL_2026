import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Match } from '../api';
import { EmptyState } from '../Brand';
import { fonts } from '../typography';
import { Button, Label, Page, Palette, PaperSurface, Title } from '../ui';

export default function Matches({
  matches,
  busy,
  loaded = false,
  error,
  reload,
  open,
}: {
  matches: Match[];
  busy: boolean;
  loaded?: boolean;
  error?: string;
  reload: () => void;
  open: (match: Match) => void;
}) {
  const p = React.useContext(Palette);
  const active = matches.filter(match => match.status === 'active');

  return (
    <Page>
      <View style={styles.headerRow}>
        <View style={styles.headerTitles}>
          <Title>Kết nối</Title>
          <Label muted>Những lời chào đang chờ bạn.</Label>
        </View>
        <Button
          compact
          label="Làm mới kết nối"
          disabled={busy}
          onPress={reload}
        />
      </View>

      {!active.length && loaded && !busy && !error && (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Lời chào đầu tiên đang chờ"
            detail="Khi cả hai cùng thích nhau, kết nối sẽ xuất hiện ở đây. Ghé Khám phá để tìm người cùng nhịp nhé."
          />
        </View>
      )}

      {active.length > 0 && (
        <View style={styles.list}>
          {active.map(match => (
            <PaperSurface key={match.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Trò chuyện với ${match.otherUser.displayName}`}
                onPress={() => open(match)}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: p.soft, borderColor: p.border }]}>
                    <Text style={[styles.initial, { color: p.accent }]}>
                      {match.otherUser.displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.onlineDot, { backgroundColor: p.accent, borderColor: p.surface }]} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: p.ink }]}>
                    {match.otherUser.displayName}
                  </Text>
                  <Text style={[styles.previewText, { color: p.muted }]}>
                    Gửi một lời chào dễ thương
                  </Text>
                </View>
                <View accessible={false} style={styles.arrowWrap}>
                  <View style={[styles.chevronTop, { backgroundColor: p.muted }]} />
                  <View style={[styles.chevronBottom, { backgroundColor: p.muted }]} />
                </View>
              </Pressable>
            </PaperSurface>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    gap: 8,
    marginBottom: 4,
  },
  headerTitles: {
    gap: 4,
  },
  emptyWrap: {
    paddingVertical: 12,
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  initial: {
    fontFamily: fonts.display,
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: fonts.strong,
    fontSize: 16,
    lineHeight: 22,
  },
  previewText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  arrowWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronTop: {
    position: 'absolute',
    width: 7,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: -2.5 }],
  },
  chevronBottom: {
    position: 'absolute',
    width: 7,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: 2 }, { translateY: 2.5 }],
  },
});
