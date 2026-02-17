import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UNIT_SUMMON_COST, GAMBLE_COST } from '../constants/gameConfig';

export type PanelAction = 'summon' | 'gamble' | 'upgrade' | 'magic' | 'units';

interface Props {
  gold: number;
  onAction: (action: PanelAction) => void;
}

const buttons: { action: PanelAction; label: string; icon: string; cost?: number; color: string; desc: string }[] = [
  { action: 'summon', label: '소환', icon: '⚔️', cost: UNIT_SUMMON_COST, color: '#e94560', desc: '유닛 뽑기' },
  { action: 'gamble', label: '도박', icon: '🎲', cost: GAMBLE_COST, color: '#f59e0b', desc: '운에 맡겨라' },
  { action: 'upgrade', label: '강화', icon: '⬆️', color: '#06b6d4', desc: '스탯 업그레이드' },
  { action: 'magic', label: '마법', icon: '✨', color: '#a855f7', desc: '마법 사용' },
  { action: 'units', label: '병력', icon: '📋', color: '#22c55e', desc: '유닛 관리' },
];

function BottomPanel({ gold, onAction }: Props) {
  // 2x2 + 1 배치: [0,1], [2,3], [4]
  const row1 = buttons.slice(0, 2);
  const row2 = buttons.slice(2, 4);
  const row3 = buttons.slice(4, 5);

  const renderButton = (btn: typeof buttons[0]) => {
    const disabled = btn.cost ? gold < btn.cost : false;
    return (
      <TouchableOpacity
        key={btn.action}
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={() => onAction(btn.action)}
        disabled={disabled}
        activeOpacity={0.65}
      >
        {/* 글로우 상단 */}
        {!disabled && <View style={[styles.buttonGlow, { backgroundColor: btn.color + '18' }]} />}

        <View style={styles.buttonContent}>
          {/* 아이콘 */}
          <View style={[styles.iconRing, {
            borderColor: disabled ? '#333' : btn.color + '70',
            backgroundColor: disabled ? '#0a0a10' : btn.color + '15',
          }]}>
            <Text style={[styles.iconText, { opacity: disabled ? 0.3 : 1 }]}>{btn.icon}</Text>
          </View>

          {/* 텍스트 영역 */}
          <View style={styles.textArea}>
            <Text style={[styles.label, { color: disabled ? '#334' : '#dde4ee' }]}>{btn.label}</Text>
            <Text style={[styles.desc, { color: disabled ? '#222' : '#556677' }]}>{btn.desc}</Text>
          </View>

          {/* 비용 */}
          {btn.cost != null && (
            <View style={[styles.costBadge, {
              backgroundColor: disabled ? '#0a0a0a' : '#1a1508',
              borderColor: disabled ? '#181818' : '#332800',
            }]}>
              <Text style={[styles.costText, disabled && { color: '#333' }]}>{btn.cost}G</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {row1.map(renderButton)}
      </View>
      <View style={styles.row}>
        {row2.map(renderButton)}
      </View>
      <View style={styles.row}>
        {row3.map(renderButton)}
      </View>
    </View>
  );
}

export default React.memo(BottomPanel);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 5,
  },
  button: {
    flex: 1,
    backgroundColor: '#0c1525',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a2a40',
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderRadius: 14,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconText: {
    fontSize: 18,
  },
  textArea: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  desc: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  costBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
  },
  costText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },
});
