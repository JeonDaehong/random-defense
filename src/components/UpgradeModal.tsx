import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Upgrades } from '../types/game';
import { getUpgradeCost, } from '../utils/helpers';
import { ATTACK_TYPE_LABELS } from '../constants/gameConfig';

interface Props {
  visible: boolean;
  onClose: () => void;
  upgrades: Upgrades;
  gold: number;
  onUpgrade: (type: keyof Upgrades) => boolean;
}

const UPGRADE_ITEMS: { key: keyof Upgrades; label: string; icon: string; desc: string }[] = [
  { key: 'penetrateAttack', label: '관통 공격력', icon: '⟫', desc: '관통형 유닛 공격력 +1' },
  { key: 'areaAttack', label: '범위 공격력', icon: '◎', desc: '범위형 유닛 공격력 +1' },
  { key: 'singleAttack', label: '단일 공격력', icon: '◆', desc: '단일형 유닛 공격력 +1' },
  { key: 'goldBonus', label: '골드 보너스', icon: '💰', desc: '골드 획득량 +10%' },
];

export default function UpgradeModal({ visible, onClose, upgrades, gold, onUpgrade }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>업그레이드</Text>

          {UPGRADE_ITEMS.map(item => {
            const level = upgrades[item.key];
            const cost = getUpgradeCost(level);
            const canAfford = gold >= cost;

            return (
              <View key={item.key} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <View>
                    <Text style={styles.itemLabel}>{item.label} Lv.{level}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                  onPress={() => onUpgrade(item.key)}
                  disabled={!canAfford}
                >
                  <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
                    {cost}G
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

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
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  itemDesc: {
    color: '#888',
    fontSize: 11,
  },
  buyBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnDisabled: {
    backgroundColor: '#333',
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  buyBtnTextDisabled: {
    color: '#666',
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
