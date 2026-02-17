import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Magic } from '../types/game';
import { MAGIC_DRAW_COST } from '../constants/gameConfig';

interface Props {
  visible: boolean;
  onClose: () => void;
  magics: Magic[];
  gold: number;
  onDrawMagic: () => void;
  onUseMagic: (magicId: string) => void;
}

const MAGIC_ICONS: Record<string, string> = {
  meteor: '☄️',
  freeze: '❄️',
  heal: '💚',
  lightning: '⚡',
  barrier: '🛡️',
};

export default function MagicModal({ visible, onClose, magics, gold, onDrawMagic, onUseMagic }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>마법</Text>

          <TouchableOpacity
            style={[styles.drawBtn, gold < MAGIC_DRAW_COST && styles.drawBtnDisabled]}
            onPress={onDrawMagic}
            disabled={gold < MAGIC_DRAW_COST}
          >
            <Text style={styles.drawBtnText}>
              랜덤 마법 획득 ({MAGIC_DRAW_COST}G)
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>보유 마법 ({magics.length})</Text>

          <ScrollView style={styles.list}>
            {magics.length === 0 ? (
              <Text style={styles.emptyText}>보유한 마법이 없습니다</Text>
            ) : (
              magics.map(magic => (
                <View key={magic.id} style={styles.magicItem}>
                  <View style={styles.magicInfo}>
                    <Text style={styles.magicIcon}>{MAGIC_ICONS[magic.type] ?? '✨'}</Text>
                    <View>
                      <Text style={styles.magicName}>{magic.name}</Text>
                      <Text style={styles.magicDesc}>{magic.description}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.useBtn}
                    onPress={() => onUseMagic(magic.id)}
                  >
                    <Text style={styles.useBtnText}>사용</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    width: '88%',
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  drawBtn: {
    backgroundColor: '#9C27B0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  drawBtnDisabled: {
    backgroundColor: '#333',
  },
  drawBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  list: {
    maxHeight: 250,
  },
  emptyText: {
    color: '#555',
    textAlign: 'center',
    paddingVertical: 20,
  },
  magicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  magicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  magicIcon: {
    fontSize: 24,
  },
  magicName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  magicDesc: {
    color: '#888',
    fontSize: 11,
  },
  useBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  useBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 12,
    backgroundColor: '#0f3460',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
