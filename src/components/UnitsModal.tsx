import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Unit, UnitGrade, UnitAttackType } from '../types/game';
import {
  GRADE_COLORS, ATTACK_TYPE_COLORS, ATTACK_TYPE_LABELS,
  GRADE_SELL_PRICE, MERGE_COST,
} from '../constants/gameConfig';

interface Props {
  visible: boolean;
  onClose: () => void;
  units: Unit[];
  gold: number;
  onSell: (unitId: string) => void;
  onMerge: (unitIds: [string, string, string]) => 'success' | 'fail' | 'destroy';
}

interface UnitGroup {
  key: string;
  attackType: UnitAttackType;
  grade: UnitGrade;
  units: Unit[];
  count: number;
}

export default function UnitsModal({ visible, onClose, units, gold, onSell, onMerge }: Props) {
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const groups = useMemo(() => {
    const grouped: Record<string, Unit[]> = {};
    for (const unit of units) {
      const key = `${unit.attackType}-${unit.grade}`;
      (grouped[key] ??= []).push(unit);
    }
    // 등급 순서 (높은 등급 먼저)
    const gradeOrder: UnitGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
    return Object.entries(grouped)
      .map(([key, groupUnits]) => ({
        key,
        attackType: groupUnits[0].attackType,
        grade: groupUnits[0].grade,
        units: groupUnits,
        count: groupUnits.length,
      }))
      .sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade));
  }, [units]);

  const handleSell = (group: UnitGroup) => {
    onSell(group.units[0].id);
  };

  const handleMerge = (group: UnitGroup) => {
    if (group.count < 3) return;
    if (group.grade === 'S') return;
    if (gold < MERGE_COST[group.grade]) return;

    const unitIds = group.units.slice(0, 3).map(u => u.id) as [string, string, string];
    const result = onMerge(unitIds);
    const labels = {
      success: '합성 성공! 상위 등급 획득!',
      fail: '합성 실패... 그대로 유지',
      destroy: '합성 실패... 유닛 파괴!',
    };
    setMergeResult(labels[result]);
    setTimeout(() => setMergeResult(null), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>병력 상황 ({units.length})</Text>

          {mergeResult && (
            <View style={styles.resultBanner}>
              <Text style={styles.resultText}>{mergeResult}</Text>
            </View>
          )}

          <ScrollView style={styles.list}>
            {groups.length === 0 ? (
              <Text style={styles.emptyText}>보유한 병력이 없습니다</Text>
            ) : (
              groups.map(group => {
                const canMerge = group.count >= 3 && group.grade !== 'S' && gold >= MERGE_COST[group.grade];
                return (
                  <View key={group.key} style={styles.groupItem}>
                    <View style={styles.groupLeft}>
                      {/* 등급 뱃지 */}
                      <View style={[styles.gradeTag, { backgroundColor: GRADE_COLORS[group.grade] }]}>
                        <Text style={styles.gradeText}>{group.grade}</Text>
                      </View>

                      {/* 유닛 정보 */}
                      <View style={styles.unitInfo}>
                        <View style={styles.unitNameRow}>
                          <Text style={[styles.unitType, { color: ATTACK_TYPE_COLORS[group.attackType] }]}>
                            {ATTACK_TYPE_LABELS[group.attackType]}
                          </Text>
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>x{group.count}</Text>
                          </View>
                        </View>
                        <Text style={styles.unitStats}>
                          ATK:{group.units[0].stats.attack} DEF:{group.units[0].stats.defense} RNG:{group.units[0].stats.range}
                        </Text>
                      </View>
                    </View>

                    {/* 액션 버튼들 */}
                    <View style={styles.groupActions}>
                      <TouchableOpacity
                        style={styles.sellBtn}
                        onPress={() => handleSell(group)}
                      >
                        <Text style={styles.sellLabel}>판매</Text>
                        <Text style={styles.sellBtnText}>{GRADE_SELL_PRICE[group.grade]}G</Text>
                      </TouchableOpacity>
                      {group.count >= 3 && group.grade !== 'S' && (
                        <TouchableOpacity
                          style={[styles.mergeBtn, !canMerge && styles.mergeBtnDisabled]}
                          onPress={() => handleMerge(group)}
                          disabled={!canMerge}
                        >
                          <Text style={styles.mergeBtnText}>합성</Text>
                          <Text style={styles.mergeCost}>{MERGE_COST[group.grade]}G</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
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
    width: '92%',
    maxHeight: '80%',
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
  resultBanner: {
    backgroundColor: '#FFD700',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultText: {
    color: '#000',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  list: {
    maxHeight: 380,
  },
  emptyText: {
    color: '#555',
    textAlign: 'center',
    paddingVertical: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gradeTag: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gradeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  unitInfo: {
    flex: 1,
  },
  unitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitType: {
    fontSize: 15,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#ffffff15',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  countText: {
    color: '#aabbcc',
    fontSize: 12,
    fontWeight: '800',
  },
  unitStats: {
    color: '#667788',
    fontSize: 10,
    marginTop: 2,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  sellBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  sellLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  sellBtnText: {
    color: '#ffffffbb',
    fontSize: 9,
    fontWeight: '600',
  },
  mergeBtn: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  mergeBtnDisabled: {
    backgroundColor: '#444',
  },
  mergeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mergeCost: {
    color: '#ffffffaa',
    fontSize: 8,
    fontWeight: '600',
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
