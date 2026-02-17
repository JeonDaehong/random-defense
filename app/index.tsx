import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Commander, SaveData } from '../src/types/game';
import { ALL_COMMANDERS, GRADE_COLORS } from '../src/constants/gameConfig';
import { loadSave, saveSave, setSelectedCommander, addCommander } from '../src/store/storage';
import { randomFromArray } from '../src/utils/helpers';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const isSmall = SCREEN_W < 400;

export default function HomeScreen() {
  const [saveData, setSaveData] = useState<SaveData | null>(null);
  const [showCommanderSelect, setShowCommanderSelect] = useState(false);
  const [showGacha, setShowGacha] = useState(false);
  const [gachaResult, setGachaResult] = useState<Commander | null>(null);

  useEffect(() => {
    loadSave().then(setSaveData);
  }, []);

  if (!saveData) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </SafeAreaView>
    );
  }

  const selectedCommander = saveData.commanders.find(
    c => c.id === saveData.selectedCommanderId
  ) ?? saveData.commanders[0];

  const handleStartGame = () => {
    router.push({
      pathname: '/game',
      params: { commanderId: selectedCommander?.id ?? '' },
    });
  };

  const handleSelectCommander = async (commander: Commander) => {
    await setSelectedCommander(commander.id);
    const updated = await loadSave();
    setSaveData(updated);
    setShowCommanderSelect(false);
  };

  const handleGacha = async () => {
    // 이미 보유하지 않은 사령관 중 랜덤
    const unowned = ALL_COMMANDERS.filter(
      c => !saveData.commanders.find(owned => owned.id === c.id)
    );
    if (unowned.length === 0) {
      setGachaResult(null);
      setShowGacha(true);
      return;
    }
    const result = randomFromArray(unowned);
    await addCommander(result);
    const updated = await loadSave();
    setSaveData(updated);
    setGachaResult(result);
    setShowGacha(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>MOBILE</Text>
        <Text style={styles.titleAccent}>DEFENSE</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>타워 디펜스 전략 게임</Text>
      </View>

      {selectedCommander && (
        <View style={styles.commanderPreview}>
          <Text style={styles.commanderIcon}>{selectedCommander.icon}</Text>
          <Text style={styles.commanderName}>{selectedCommander.name}</Text>
          <Text style={[styles.commanderRarity, { color: GRADE_COLORS[selectedCommander.rarity] }]}>
            {selectedCommander.rarity}등급
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>최고 점수</Text>
          <Text style={styles.statValue}>{saveData.highScore}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>보유 사령관</Text>
          <Text style={styles.statValue}>{saveData.commanders.length}/{ALL_COMMANDERS.length}</Text>
        </View>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
          <Text style={styles.startButtonText}>게임 시작</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowCommanderSelect(true)}
          >
            <Text style={styles.secondaryButtonText}>사령관 선택</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGacha}>
            <Text style={styles.secondaryButtonText}>사령관 뽑기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 사령관 선택 모달 */}
      <Modal visible={showCommanderSelect} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>사령관 선택</Text>
            <ScrollView style={styles.commanderList}>
              {saveData.commanders.map(cmd => (
                <TouchableOpacity
                  key={cmd.id}
                  style={[
                    styles.commanderItem,
                    cmd.id === selectedCommander?.id && styles.commanderItemSelected,
                  ]}
                  onPress={() => handleSelectCommander(cmd)}
                >
                  <Text style={styles.cmdIcon}>{cmd.icon}</Text>
                  <View style={styles.cmdInfo}>
                    <Text style={styles.cmdName}>{cmd.name}</Text>
                    <Text style={styles.cmdDesc}>{cmd.description}</Text>
                    <Text style={[styles.cmdRarity, { color: GRADE_COLORS[cmd.rarity] }]}>
                      {cmd.rarity}등급
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCommanderSelect(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 가챠 결과 모달 */}
      <Modal visible={showGacha} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>사령관 뽑기</Text>
            {gachaResult ? (
              <View style={styles.gachaResult}>
                <Text style={styles.gachaIcon}>{gachaResult.icon}</Text>
                <Text style={[styles.gachaName, { color: GRADE_COLORS[gachaResult.rarity] }]}>
                  {gachaResult.name}
                </Text>
                <Text style={styles.gachaDesc}>{gachaResult.description}</Text>
                <Text style={styles.gachaNew}>NEW!</Text>
              </View>
            ) : (
              <Text style={styles.gachaEmpty}>모든 사령관을 보유 중입니다!</Text>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowGacha(false)}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: isSmall ? 16 : 40,
  },
  title: {
    fontSize: isSmall ? 32 : 48,
    fontWeight: '900',
    color: '#e94560',
    letterSpacing: isSmall ? 4 : 8,
  },
  titleAccent: {
    fontSize: isSmall ? 36 : 56,
    fontWeight: '900',
    color: '#0f3460',
    letterSpacing: 12,
    textShadowColor: '#e94560',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  divider: {
    width: 80,
    height: 3,
    backgroundColor: '#e94560',
    marginVertical: 12,
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 4,
  },
  commanderPreview: {
    alignItems: 'center',
    backgroundColor: '#16213e',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  commanderIcon: {
    fontSize: 48,
  },
  commanderName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  commanderRarity: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statBox: {
    backgroundColor: '#16213e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  buttonSection: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#e94560',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#16213e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  secondaryButtonText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: SCREEN_W - 32,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  commanderList: {
    maxHeight: 300,
  },
  commanderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#16213e',
  },
  commanderItemSelected: {
    borderWidth: 2,
    borderColor: '#e94560',
  },
  cmdIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  cmdInfo: {
    flex: 1,
  },
  cmdName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cmdDesc: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  cmdRarity: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#0f3460',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gachaResult: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  gachaIcon: {
    fontSize: 72,
  },
  gachaName: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  gachaDesc: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  gachaNew: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  gachaEmpty: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
