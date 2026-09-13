// src/components/Common.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SC, srcColor, T } from '../data/translations';

export function Badge({ risk, t }) {
  const s = SC[risk] || SC.caution;
  const label = { safe: t.safe, info: t.info, caution: t.caution, danger: t.danger }[risk] || risk;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.icon}  {label}</Text>
    </View>
  );
}

/** 상세 화면 하단 고정 면책 문구 (한 줄) */
export function DisclaimerFooter({ lang = 'ko', style }) {
  const text = (T[lang] || T.ko).disclaimerFooter;
  return (
    <View style={[styles.disclaimer, style]}>
      <Text style={styles.disclaimerText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

export function SrcBadge({ src, t }) {
  const label = { admin: t.srcAdmin, official: t.srcOfficial, user: t.srcUser }[src] || src;
  return (
    <View style={[styles.srcBadge, { backgroundColor: '#F0EDE8' }]}>
      <Text style={[styles.srcBadgeText, { color: srcColor[src] || '#999' }]}>{label}</Text>
    </View>
  );
}

export function FilterBar({ filters, active, onSelect }) {
  return (
    <View style={styles.filterRow}>
      {filters.map(f => {
        const s = SC[f.key] || {};
        const isActive = active === f.key;
        const isAll = f.key === 'all';
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onSelect(f.key)}
            style={[
              styles.filterBtn,
              {
                borderColor: isActive ? (isAll ? '#E8704A' : s.color || '#E8704A') : '#E8E8E8',
                backgroundColor: isActive ? (isAll ? '#E8704A' : s.bg || '#EEE') : 'white',
              }
            ]}
          >
            <Text style={[
              styles.filterText,
              { color: isActive ? (isAll ? 'white' : s.color || '#333') : '#999',
                fontWeight: isActive ? '700' : '400' }
            ]}>
              {(!isAll && s.icon) ? s.icon + ' ' : ''}{f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function WarnBox({ text }) {
  return (
    <View style={styles.warnBox}>
      <Text style={styles.warnIcon}>⚠️</Text>
      <Text style={styles.warnText}>{text}</Text>
    </View>
  );
}

export function TagList({ tags, risk }) {
  const s = SC[risk] || SC.caution;
  return (
    <View style={styles.tagRow}>
      {tags.map((tag, i) => (
        <View key={i} style={[styles.tag, { backgroundColor: s.bg }]}>
          <Text style={[styles.tagText, { color: s.color }]}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    borderTopWidth: 1, borderTopColor: '#F0EDE8',
    paddingTop: 8, paddingHorizontal: 4, marginTop: 4,
  },
  disclaimerText: { fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 16 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  srcBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  srcBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  filterText: {
    fontSize: 11,
  },
  warnBox: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1.5,
    borderColor: '#F5C842',
    borderRadius: 9,
    padding: 10,
    marginBottom: 11,
    flexDirection: 'row',
    gap: 5,
  },
  warnIcon: { fontSize: 12 },
  warnText: { fontSize: 10, color: '#8B6914', flex: 1, lineHeight: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  tagText: { fontSize: 11 },
});
