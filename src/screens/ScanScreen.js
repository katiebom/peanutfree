// src/screens/ScanScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FOODS } from '../data/database';
import { Badge, TagList } from '../components/Common';
import { SC } from '../data/translations';

export default function ScanScreen({ lang, t }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState(null);
  const [active, setActive] = useState(true);

  function handleBarcode({ data }) {
    if (scanned) return;
    setScanned(true);
    setActive(false);
    const found = FOODS.find(f => f.barcode === data);
    setResult({ barcode: data, item: found || null });
  }

  function reset() {
    setScanned(false);
    setResult(null);
    setActive(true);
  }

  if (!permission) return <View style={styles.centered} />;

  if (!permission.granted) {
    return (
      <View style={styles.permBox}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>{t.scanTitle}</Text>
        <Text style={styles.permSub}>바코드 스캔을 위해 카메라 권한이 필요합니다.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>권한 허용하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {active && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={handleBarcode}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'qr', 'code128'] }}
        />
      )}
      {!active && <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />}

      {/* 스캔 가이드 UI */}
      <View style={styles.overlay}>
        <View style={styles.topArea}>
          <Text style={styles.scanTitle}>{t.scanTitle}</Text>
          <Text style={styles.scanSub}>{t.scanSub}</Text>
        </View>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.bottomArea} />
      </View>

      {/* 결과 모달 */}
      <Modal
        visible={!!result}
        transparent
        animationType="slide"
        onRequestClose={reset}
      >
        <View style={styles.resultOverlay}>
          <View style={styles.resultSheet}>
            <View style={styles.handle} />
            {result?.item ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.resultFound}>✅  {t.scanResult}</Text>
                <View style={styles.resultCard}>
                  <Text style={styles.resultEmoji}>{result.item.img}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{result.item[lang].name}</Text>
                    <Text style={styles.resultBrand}>{result.item.brand} · {result.item[lang].cat}</Text>
                  </View>
                </View>
                <View style={[styles.riskBox, { backgroundColor: SC[result.item.risk].bg }]}>
                  <Badge risk={result.item.risk} t={t} />
                  <View style={{ marginTop: 8 }}>
                    <TagList tags={result.item[lang].tags} risk={result.item.risk} />
                  </View>
                </View>
                {result.item[lang].note && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>💬  {result.item[lang].note}</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.notFound}>
                <Text style={styles.notFoundIcon}>❓</Text>
                <Text style={styles.notFoundText}>{t.scanNotFound}</Text>
                <Text style={styles.barcodeText}>바코드: {result?.barcode}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.rescanBtn} onPress={reset}>
              <Text style={styles.rescanText}>다시 스캔하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, backgroundColor: '#FAF8F5' },
  permBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#FAF8F5',
  },
  permIcon: { fontSize: 52, marginBottom: 16 },
  permTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  permSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 },
  permBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'space-between',
  },
  topArea: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24,
  },
  scanTitle: { color: 'white', fontSize: 18, fontWeight: '900' },
  scanSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  scanFrame: {
    width: 240, height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: '#E8704A', borderWidth: 3,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomArea: { flex: 1 },
  resultOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  resultSheet: {
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  resultFound: { fontSize: 14, fontWeight: '700', color: '#2D8A4E', marginBottom: 14 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FAF8F5', borderRadius: 12, padding: 14, marginBottom: 12,
  },
  resultEmoji: { fontSize: 32 },
  resultName: { fontWeight: '800', fontSize: 15 },
  resultBrand: { fontSize: 11, color: '#999', marginTop: 2 },
  riskBox: { borderRadius: 12, padding: 14, marginBottom: 10 },
  noteBox: { backgroundColor: '#FAF8F5', borderRadius: 8, padding: 10, marginBottom: 10 },
  noteText: { fontSize: 11, color: '#888' },
  notFound: { alignItems: 'center', paddingVertical: 24 },
  notFoundIcon: { fontSize: 40, marginBottom: 12 },
  notFoundText: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 6 },
  barcodeText: { fontSize: 11, color: '#BBB' },
  rescanBtn: {
    backgroundColor: '#E8704A', borderRadius: 12,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  rescanText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
