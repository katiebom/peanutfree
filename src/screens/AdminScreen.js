// src/screens/AdminScreen.js
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  subscribeReviews, updateReview, deleteReview, addReviewFromAdmin,
  subscribePending, setModerationStatus, setModerationRisk,
  subscribeFeedback, setFeedbackHandled,
  STATUS_APPROVED, STATUS_REJECTED,
} from '../firebase/dbService';
import { CUISINE_TYPES, CUISINE_EMOJI, inferCuisineForReview } from '../utils/inferCuisine';
import { getCurrentUser } from '../firebase/authService';

const RISK_COLOR = {
  safe: '#2D8A4E', caution: '#D9622F', danger: '#C13A2D', info: '#4A7FBF', unknown: '#8A8A8A',
};
const RISK_LABEL = { safe: '안전(미검증)', caution: '요주의', danger: '고위험', info: '성분 확인 필요', unknown: '미확인' };

// 의견 보내기 칩 값 → 사람이 읽는 말 (FeedbackModal 과 같은 키)
const FB_WHERE = { brand: '브랜드', restaurant: '식당', food: '식품', map: '지도', card: '알레르기카드', account: '가입·로그인', other: '기타' };
const FB_KIND = { bug: '오류', wrong: '정보 틀림', missing: '없음', hard: '불편', idea: '제안', good: '칭찬' };
const FB_KIND_COLOR = { bug: '#C13A2D', wrong: '#C13A2D', missing: '#D9622F', hard: '#D9622F', idea: '#4A7FBF', good: '#2D8A4E' };

function fbDate(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
}

// ── 받은 의견 한 줄 ───────────────────────────────────────
function FeedbackRow({ item, onToggle }) {
  const kindColor = FB_KIND_COLOR[item.kind] || '#8A7F72';
  return (
    <View style={[s.fbRow, item.handled && s.fbRowDone]}>
      <View style={s.fbTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          {!!item.kind && (
            <View style={[s.fbTag, { backgroundColor: kindColor }]}>
              <Text style={s.fbTagText}>{FB_KIND[item.kind] || item.kind}</Text>
            </View>
          )}
          {!!item.where && <Text style={s.fbWhere}>{FB_WHERE[item.where] || item.where}</Text>}
        </View>
        <Text style={s.fbMeta}>{fbDate(item.createdAt)}</Text>
      </View>
      {!!item.message && <Text style={s.fbMessage}>{item.message}</Text>}
      <View style={s.fbBottom}>
        <Text style={s.fbMeta} numberOfLines={1}>
          {[item.appVersion && `v${item.appVersion}`, item.platform, item.contact].filter(Boolean).join('  ·  ')}
        </Text>
        <TouchableOpacity style={[s.fbBtn, item.handled && s.fbBtnDone]} onPress={() => onToggle(item)}>
          <Text style={[s.fbBtnText, item.handled && s.fbBtnTextDone]}>{item.handled ? '처리함' : '처리 표시'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 음식 종류 수정 모달 ───────────────────────────────────
function CuisineEditModal({ item, visible, onClose, onSave }) {
  const [selected, setSelected] = useState(item?.cuisineType || '기타');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelected(item?.cuisineType || '기타');
  }, [visible, item]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } catch {
      Alert.alert('오류', '저장 중 문제가 발생했습니다.');
    }
    setSaving(false);
  }

  if (!item) return null;
  const name = item.ko?.name || item.name || '(이름없음)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>{name}</Text>
          <Text style={m.subtitle}>음식 종류 선택</Text>
          <ScrollView style={m.gridScroll} showsVerticalScrollIndicator={false}>
          <View style={m.grid}>
            {CUISINE_TYPES.map(c => {
              const active = selected === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelected(c)}
                  style={[m.chip, active && m.chipActive]}
                >
                  <Text style={m.chipIcon}>{CUISINE_EMOJI[c]}</Text>
                  <Text style={[m.chipText, active && m.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </ScrollView>
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
              <Text style={m.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={m.saveText}>저장</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── 식당 행 ───────────────────────────────────────────────
function RestaurantRow({ item, onEditCuisine, onDelete }) {
  const name = item.ko?.name || item.name || '(이름없음)';
  const cuisine = item.cuisineType || '기타';
  const riskColor = RISK_COLOR[item.risk] || '#999';

  return (
    <View style={s.row}>
      <View style={[s.riskBar, { backgroundColor: riskColor }]} />
      <View style={s.rowBody}>
        <Text style={s.rowName} numberOfLines={1}>{name}</Text>
        <Text style={s.rowAddr} numberOfLines={1}>{item.address || '주소 없음'}</Text>
        <View style={s.rowMeta}>
          <View style={s.riskChip}>
            <Text style={[s.riskChipText, { color: riskColor }]}>
              {RISK_LABEL[item.risk] || item.risk}
            </Text>
          </View>
          <TouchableOpacity style={s.cuisineChip} onPress={() => onEditCuisine(item)}>
            <Text style={s.cuisineChipText}>{CUISINE_EMOJI[cuisine]} {cuisine}</Text>
            <Text style={s.cuisineChipEdit}>  수정</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item)}>
        <Text style={s.deleteBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── 제보 행 ───────────────────────────────────────────────
function ReportRow({ item, onApprove, onDismiss }) {
  const RISK_COLOR = { safe: '#2D8A4E', caution: '#D9622F', danger: '#C13A2D', info: '#4A7FBF', unknown: '#8A8A8A' };
  const RISK_LABEL = { safe: '안전(미검증)', caution: '요주의', danger: '고위험', info: '성분 확인 필요', unknown: '미확인' };
  const riskColor = RISK_COLOR[item.risk] || '#999';

  return (
    <View style={s.reportRow}>
      <View style={[s.reportRiskBar, { backgroundColor: riskColor }]} />
      <View style={s.reportBody}>
        <View style={s.reportTop}>
          <Text style={s.reportTarget} numberOfLines={1}>{item.targetImg || '📌'} {item.targetName}</Text>
          <View style={[s.reportRiskChip, { backgroundColor: riskColor + '22' }]}>
            <Text style={[s.reportRiskText, { color: riskColor }]}>{RISK_LABEL[item.risk] || item.risk}</Text>
          </View>
        </View>
        {item.menuItem ? <Text style={s.reportMeta}>메뉴: {item.menuItem}</Text> : null}
        {item.note ? <Text style={s.reportNote} numberOfLines={2}>{item.note}</Text> : null}
        <Text style={s.reportUser}>📝 {item.userNickname || '익명'} · {item.targetType}</Text>
        <View style={s.reportBtns}>
          <TouchableOpacity style={s.approveBtn} onPress={() => onApprove(item)}>
            <Text style={s.approveBtnText}>✓ 반영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dismissBtn} onPress={() => onDismiss(item)}>
            <Text style={s.dismissBtnText}>✕ 삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── 검수 대기 행 ──────────────────────────────────────────
const COLLECTION_LABEL = { brands: '브랜드', foods: '식품', reviews: '식당 리뷰' };
const RISK_KEYS = ['safe', 'caution', 'danger', 'info'];

function pendingName(item) {
  return item.ko?.name || item.name || '(이름없음)';
}

function pendingDetailText(item) {
  const d = item.ko || {};
  const lines = [
    `구분: ${COLLECTION_LABEL[item._collection] || item._collection}`,
    `이름: ${pendingName(item)}`,
    item.brand ? `제조사: ${item.brand}` : null,
    d.cat ? `카테고리: ${d.cat}` : null,
    `위험도: ${RISK_LABEL[item.risk] || item.risk || '-'}`,
    d.reason ? `
이유:
${d.reason}` : null,
    d.review ? `
내용:
${d.review}` : null,
    d.note ? `
메모:
${d.note}` : null,
    item.address ? `
주소: ${item.address}` : null,
    item.cuisineType ? `음식 종류: ${item.cuisineType}` : null,
    `
제보자: ${item.submitterName || item.author || '익명'}`,
    `제보자 uid: ${item.submittedBy || '-'}`,
    item.createdAt?.seconds ? `제보일: ${new Date(item.createdAt.seconds * 1000).toLocaleString('ko-KR')}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

function PendingRow({ item, onRisk, onApprove, onReject }) {
  const riskColor = RISK_COLOR[item.risk] || '#999';
  return (
    <View style={s.reportRow}>
      <View style={[s.reportRiskBar, { backgroundColor: riskColor }]} />
      <View style={s.reportBody}>
        <View style={s.reportTop}>
          <Text style={s.reportTarget} numberOfLines={1}>
            {item.img || (item._collection === 'reviews' ? '🍽️' : '📌')} {pendingName(item)}
          </Text>
          <View style={s.pendingTypeChip}>
            <Text style={s.pendingTypeText}>{COLLECTION_LABEL[item._collection]}</Text>
          </View>
        </View>
        {(item.ko?.reason || item.ko?.review) ? (
          <Text style={s.reportNote} numberOfLines={2}>{item.ko?.reason || item.ko?.review}</Text>
        ) : null}
        <Text style={s.reportUser}>📝 {item.submitterName || item.author || '익명'}</Text>
        <View style={s.pendingRiskRow}>
          {RISK_KEYS.map(k => {
            const active = item.risk === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { if (!active) onRisk(item, k); }}
                style={[s.pendingRiskBtn, active && { backgroundColor: RISK_COLOR[k], borderColor: RISK_COLOR[k] }]}
              >
                <Text style={[s.pendingRiskBtnText, active && { color: 'white' }]}>{RISK_LABEL[k]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.reportBtns}>
          <TouchableOpacity
            style={s.detailBtn}
            onPress={() => Alert.alert('제보 상세', pendingDetailText(item))}
          >
            <Text style={s.detailBtnText}>상세</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.approveBtn} onPress={() => onApprove(item)}>
            <Text style={s.approveBtnText}>✓ 승인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dismissBtn} onPress={() => onReject(item)}>
            <Text style={s.dismissBtnText}>✕ 반려</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── 메인 AdminScreen ──────────────────────────────────────
export default function AdminScreen({ onExit, t }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [stats, setStats] = useState({ total: 0, withCuisine: 0 });
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState('all'); // 'all'|'danger'|'caution'|'safe'
  const [pending, setPending] = useState({ brands: [], foods: [], reviews: [] });
  const [pendingFilter, setPendingFilter] = useState('all'); // 'all'|'brands'|'foods'|'reviews'
  const [feedback, setFeedback] = useState([]);
  const [feedbackOnlyNew, setFeedbackOnlyNew] = useState(true);

  useEffect(() => {
    const unsubs = ['brands', 'foods', 'reviews'].map(name =>
      subscribePending(name, data => setPending(prev => ({ ...prev, [name]: data })))
    );
    return () => unsubs.forEach(u => u());
  }, []);

  const pendingAll = [...pending.brands, ...pending.foods, ...pending.reviews];
  const pendingCount = pendingAll.length;

  async function handlePendingRisk(item, risk) {
    try {
      await setModerationRisk(item._collection, item.id, risk);
    } catch (e) {
      Alert.alert('오류', `위험도 변경 중 문제가 발생했습니다.\n(${e?.code || e?.message || 'unknown'})`);
    }
  }

  function handlePendingApprove(item) {
    Alert.alert(
      '승인',
      `"${pendingName(item)}"을(를) 위험도 "${RISK_LABEL[item.risk] || item.risk}"(으)로 공개할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '승인', onPress: async () => {
            try {
              await setModerationStatus(item._collection, item.id, STATUS_APPROVED);
            } catch (e) {
              Alert.alert('오류', `승인 중 문제가 발생했습니다.\n(${e?.code || e?.message || 'unknown'})`);
            }
          },
        },
      ]
    );
  }

  function handlePendingReject(item) {
    Alert.alert(
      '반려',
      `"${pendingName(item)}" 제보를 반려할까요?\n(삭제되지 않고 비공개 상태로 남습니다)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '반려', style: 'destructive', onPress: async () => {
            try {
              await setModerationStatus(item._collection, item.id, STATUS_REJECTED);
            } catch (e) {
              Alert.alert('오류', `반려 중 문제가 발생했습니다.\n(${e?.code || e?.message || 'unknown'})`);
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    const unsub = subscribeReviews(data => {
      setRestaurants(data);
      setStats({
        total: data.length,
        withCuisine: data.filter(r => r.cuisineType && r.cuisineType !== '기타').length,
      });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeFeedback(setFeedback);
    return () => unsub();
  }, []);

  useEffect(() => {
    // subscribeUserReports는 targetId별 구독이므로, 전체 목록은 별도 구독 필요
    // 여기서는 간단히 subscribeMapReports 대신 전체 userReports를 onSnapshot으로 가져옴
    const { collection, onSnapshot, orderBy, query } = require('firebase/firestore');
    const { db } = require('../firebase/config');
    const q = query(collection(db, 'userReports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => {
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setReportsLoading(false);
      },
      err => {
        console.warn('[AdminScreen] userReports 구독 실패:', err.code);
        setReportsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function handleSaveCuisine(newType) {
    await updateReview(editTarget.id, { cuisineType: newType });
  }

  function handleDelete(item) {
    const name = item.ko?.name || item.name || '(이름없음)';
    Alert.alert(
      '식당 삭제',
      `"${name}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview(item.id);
            } catch {
              Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
            }
          },
        },
      ]
    );
  }

  // cuisineType 없는 항목 일괄 설정 — ko.cat / 이름에서 추론, 안 맞는 것만 '기타'
  async function handleBulkSetDefault() {
    const missing = restaurants.filter(r => !r.cuisineType);
    if (missing.length === 0) {
      Alert.alert('완료', '모든 식당에 음식 종류가 설정되어 있습니다.');
      return;
    }
    const plan = missing.map(r => ({ id: r.id, cuisineType: inferCuisineForReview(r) }));
    const counts = plan.reduce((acc, p) => { acc[p.cuisineType] = (acc[p.cuisineType] || 0) + 1; return acc; }, {});
    const preview = CUISINE_TYPES
      .filter(c => counts[c])
      .map(c => `${CUISINE_EMOJI[c]} ${c}: ${counts[c]}`)
      .join('\n');
    Alert.alert(
      '일괄 설정 미리보기',
      `음식 종류가 없는 식당 ${missing.length}개를 카테고리·이름으로 추론해 설정합니다.\n\n${preview}\n\n'기타'로 분류된 항목은 직접 확인해 주세요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: `${missing.length}개 설정`, onPress: async () => {
            try {
              await Promise.all(plan.map(p => updateReview(p.id, { cuisineType: p.cuisineType })));
              Alert.alert('완료', `${missing.length}개 식당이 업데이트 되었습니다.`);
            } catch {
              Alert.alert('오류', '일부 항목 업데이트 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  }

  async function handleApproveReport(report) {
    // 식당 DB(reviews)에는 식당 제보만 반영한다. 식품/브랜드 제보가 식당으로 들어가던 문제 방지.
    if (report.targetType !== 'restaurant') {
      Alert.alert('반영 불가', '식당 제보만 식당 DB에 반영할 수 있습니다.\n식품·브랜드 제보는 해당 항목에서 직접 수정해 주세요.');
      return;
    }
    Alert.alert(
      '제보 반영',
      `"${report.targetName}" 제보를 공식 DB에 반영하시겠습니까?\n위험도: ${report.risk}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '반영', onPress: async () => {
            try {
              const uid = getCurrentUser()?.uid;
              if (!uid) throw new Error('not signed in');
              // dbService 경유: status(관리자면 approved) · submittedBy · cuisineType 추론 보장
              await addReviewFromAdmin({
                ko: { name: report.targetName, cat: '식당', review: report.note || '' },
                en: { name: report.targetName, cat: 'Restaurant', review: report.note || '' },
                risk: report.risk,
                author: report.userNickname || '익명',
                date: new Date().toISOString().slice(0, 10),
                ...(report.address ? { address: report.address } : {}),
                ...(report.lat != null && report.lng != null ? { lat: report.lat, lng: report.lng } : {}),
              }, uid);
              const { deleteDoc, doc } = require('firebase/firestore');
              const { db } = require('../firebase/config');
              await deleteDoc(doc(db, 'userReports', report.id));
              Alert.alert('반영 완료', '공식 DB에 추가되었습니다.');
            } catch (e) {
              if (__DEV__) console.warn('[AdminScreen] 제보 반영 실패:', e);
              Alert.alert('오류', '반영 중 문제가 생겼습니다.');
            }
          }
        }
      ]
    );
  }

  async function handleDismissReport(report) {
    Alert.alert(
      '제보 삭제',
      `"${report.targetName}" 제보를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            try {
              const { deleteDoc, doc } = require('firebase/firestore');
              const { db } = require('../firebase/config');
              await deleteDoc(doc(db, 'userReports', report.id));
            } catch {
              Alert.alert('오류', '삭제 중 문제가 생겼습니다.');
            }
          }
        }
      ]
    );
  }

  const unsetCount = restaurants.filter(r => !r.cuisineType).length;
  const feedbackNew = feedback.filter(f => !f.handled);
  const feedbackShown = feedbackOnlyNew ? feedbackNew : feedback;

  async function handleFeedbackToggle(item) {
    try {
      await setFeedbackHandled(item.id, !item.handled);
    } catch {
      Alert.alert('오류', '처리 표시를 저장하지 못했습니다.');
    }
  }

  return (
    <View style={s.container}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.headerTitle}>🛡️  관리자</Text>
          {pendingCount > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>검수 {pendingCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.exitBtn} onPress={onExit}>
          <Text style={s.exitText}>{t?.adminExit || '나가기'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* 통계 카드 */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{stats.total}</Text>
            <Text style={s.statLabel}>전체 식당</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: '#5B3EE8' }]}>{stats.withCuisine}</Text>
            <Text style={s.statLabel}>종류 설정됨</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: unsetCount > 0 ? '#D9622F' : '#2D8A4E' }]}>
              {unsetCount}
            </Text>
            <Text style={s.statLabel}>미설정</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: reports.length > 0 ? '#E8B84A' : 'white' }]}>{reports.length}</Text>
            <Text style={s.statLabel}>신규 제보</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: feedbackNew.length > 0 ? '#E8B84A' : 'white' }]}>{feedbackNew.length}</Text>
            <Text style={s.statLabel}>새 의견</Text>
          </View>
        </View>

        {/* 받은 의견 */}
        <View style={s.section}>
          <View style={s.reportHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={[s.sectionTitle, { marginBottom: 0 }]}>💬  받은 의견</Text>
              <View style={[s.countBadge, feedbackNew.length === 0 && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Text style={s.countBadgeText}>{feedbackNew.length}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {[[true, `안 본 것 ${feedbackNew.length}`], [false, `전체 ${feedback.length}`]].map(([key, label]) => (
                <TouchableOpacity
                  key={String(key)}
                  onPress={() => setFeedbackOnlyNew(key)}
                  style={[s.filterChip, feedbackOnlyNew === key && s.filterChipActive]}
                >
                  <Text style={[s.filterChipText, feedbackOnlyNew === key && s.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {feedbackShown.length === 0 && <Text style={s.emptyText}>새로 받은 의견이 없습니다.</Text>}
          {feedbackShown.map(item => (
            <FeedbackRow key={item.id} item={item} onToggle={handleFeedbackToggle} />
          ))}
        </View>

        {/* 검수 대기 */}
        <View style={s.section}>
          <View style={s.reportHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={[s.sectionTitle, { marginBottom: 0 }]}>🕐  검수 대기</Text>
              <View style={[s.countBadge, pendingCount === 0 && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Text style={s.countBadgeText}>{pendingCount}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[['all', `전체 ${pendingCount}`], ['brands', `브랜드 ${pending.brands.length}`], ['foods', `식품 ${pending.foods.length}`], ['reviews', `리뷰 ${pending.reviews.length}`]].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setPendingFilter(key)}
                    style={[s.filterChip, pendingFilter === key && s.filterChipActive]}
                  >
                    <Text style={[s.filterChipText, pendingFilter === key && s.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          {pendingCount === 0 && (
            <Text style={s.emptyText}>검수 대기 중인 제보가 없습니다.</Text>
          )}
          {(pendingFilter === 'all' ? pendingAll : pending[pendingFilter]).map(item => (
            <PendingRow
              key={`${item._collection}_${item.id}`}
              item={item}
              onRisk={handlePendingRisk}
              onApprove={handlePendingApprove}
              onReject={handlePendingReject}
            />
          ))}
        </View>

        {/* 일괄 기본값 버튼 */}
        {unsetCount > 0 && (
          <TouchableOpacity style={s.bulkBtn} onPress={handleBulkSetDefault}>
            <Text style={s.bulkBtnText}>
              ⚡  미설정 {unsetCount}개 → 카테고리로 자동 분류
            </Text>
          </TouchableOpacity>
        )}

        {/* 유저 제보 모더레이션 */}
        <View style={s.section}>
          <View style={s.reportHeader}>
            <Text style={s.sectionTitle}>📬  유저 제보  ({reports.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[['all','전체'],['danger','위험'],['caution','주의'],['safe','안전'],['info','확인필요']].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setReportFilter(key)}
                    style={[s.filterChip, reportFilter === key && s.filterChipActive]}
                  >
                    <Text style={[s.filterChipText, reportFilter === key && s.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {reportsLoading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#5B3EE8" />
              <Text style={s.loadingText}>불러오는 중...</Text>
            </View>
          )}
          {!reportsLoading && reports.length === 0 && (
            <Text style={s.emptyText}>새 제보가 없습니다.</Text>
          )}
          {reports
            .filter(r => reportFilter === 'all' || r.risk === reportFilter)
            .map(item => (
              <ReportRow
                key={item.id}
                item={item}
                onApprove={handleApproveReport}
                onDismiss={handleDismissReport}
              />
            ))
          }
        </View>

        {/* 식당 목록 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🍽️  식당 목록  ({restaurants.length})</Text>

          {loading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#5B3EE8" />
              <Text style={s.loadingText}>불러오는 중...</Text>
            </View>
          )}

          {!loading && restaurants.length === 0 && (
            <Text style={s.emptyText}>등록된 식당이 없습니다.</Text>
          )}

          {restaurants.map(item => (
            <RestaurantRow
              key={item.id}
              item={item}
              onEditCuisine={setEditTarget}
              onDelete={handleDelete}
            />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CuisineEditModal
        item={editTarget}
        visible={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveCuisine}
      />
    </View>
  );
}

// ── AdminScreen 스타일 ────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 36,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '900' },
  exitBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  exitText: { color: 'white', fontSize: 13 },
  scroll: { flex: 1 },
  // 통계
  statsRow: {
    flexDirection: 'row', gap: 10, margin: 16, marginBottom: 8,
  },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  statNum: { color: 'white', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  // 일괄 설정 버튼
  fbRow: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  fbRowDone: { opacity: 0.55 },
  fbTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fbTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fbTagText: { color: 'white', fontSize: 11, fontWeight: '800' },
  fbWhere: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  fbMessage: { color: 'white', fontSize: 14, lineHeight: 21, marginTop: 8 },
  fbBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  fbMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, flexShrink: 1 },
  fbBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.14)' },
  fbBtnDone: { backgroundColor: 'rgba(45,138,78,0.35)' },
  fbBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  fbBtnTextDone: { color: '#9BE5B6' },
  bulkBtn: {
    backgroundColor: 'rgba(91,62,232,0.25)', borderRadius: 10,
    marginHorizontal: 16, marginBottom: 8,
    padding: 12, borderWidth: 1, borderColor: 'rgba(91,62,232,0.5)',
  },
  bulkBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  // 섹션
  section: {
    margin: 16, marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14,
  },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 },
  // 식당 행
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, marginBottom: 8, overflow: 'hidden',
  },
  riskBar: { width: 4, alignSelf: 'stretch' },
  rowBody: { flex: 1, padding: 12 },
  rowName: { color: 'white', fontSize: 14, fontWeight: '700' },
  rowAddr: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  rowMeta: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  riskChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  riskChipText: { fontSize: 11, fontWeight: '700' },
  cuisineChip: {
    backgroundColor: 'rgba(91,62,232,0.25)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    flexDirection: 'row', alignItems: 'center',
  },
  cuisineChipText: { fontSize: 11, color: '#A78BFA', fontWeight: '700' },
  cuisineChipEdit: { fontSize: 10, color: 'rgba(167,139,250,0.7)' },
  deleteBtn: {
    padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  // 제보 모더레이션
  reportRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, marginBottom: 8, overflow: 'hidden',
  },
  reportRiskBar: { width: 4 },
  reportBody: { flex: 1, padding: 12 },
  reportTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  reportTarget: { flex: 1, color: 'white', fontSize: 14, fontWeight: '700' },
  reportRiskChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  reportRiskText: { fontSize: 11, fontWeight: '700' },
  reportMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 },
  reportNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6, lineHeight: 18 },
  reportUser: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 8 },
  reportBtns: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    flex: 1, backgroundColor: 'rgba(45,138,78,0.25)',
    borderRadius: 8, padding: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(45,138,78,0.5)',
  },
  approveBtnText: { color: '#4CAF50', fontSize: 12, fontWeight: '800' },
  dismissBtn: {
    flex: 1, backgroundColor: 'rgba(193,58,45,0.2)',
    borderRadius: 8, padding: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(193,58,45,0.4)',
  },
  dismissBtnText: { color: '#EF5350', fontSize: 12, fontWeight: '800' },
  reportHeader: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  filterChipActive: { backgroundColor: 'rgba(91,62,232,0.35)', borderColor: '#5B3EE8' },
  filterChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  filterChipTextActive: { color: '#A78BFA', fontWeight: '700' },
  // 검수 대기
  countBadge: {
    backgroundColor: '#E8704A', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  countBadgeText: { color: 'white', fontSize: 11, fontWeight: '900' },
  pendingTypeChip: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },
  pendingTypeText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  pendingRiskRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  pendingRiskBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  pendingRiskBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  detailBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  detailBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800' },
});

// ── CuisineEditModal 스타일 ───────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  sheet: {
    backgroundColor: '#1A1A2E', borderRadius: 18,
    padding: 22, width: '100%', maxWidth: 360,
  },
  title: { color: 'white', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 18 },
  gridScroll: { maxHeight: 360, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: { backgroundColor: '#5B3EE8', borderColor: '#5B3EE8' },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  chipTextActive: { color: 'white', fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 13, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 2, padding: 13, borderRadius: 10,
    backgroundColor: '#5B3EE8', alignItems: 'center',
  },
  saveText: { color: 'white', fontSize: 14, fontWeight: '900' },
});
