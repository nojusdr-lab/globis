import React, { useState, useEffect } from 'react';
import {
  Modal,
  Linking,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TOKENS } from '../theme/tokens';
import { TRANSLATIONS } from '../data/translations';

export default function PetDetailsModal({
  visible,
  pet,
  lang,
  onClose,
  onLikeFromDetails,
}) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  useEffect(()=>setSelectedPhotoIdx(0),[pet?.id]);
  if (!pet) return null;
  const t = TRANSLATIONS[lang];

  const age = lang === 'lt' ? pet.ageLt : pet.ageEn;
  const bio = lang === 'lt' ? pet.bioLt : pet.bioEn;
  const photos = pet.photos || [];
  const isLongTerm = pet.waitingDays >= 180;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.dragHandle} />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={TOKENS.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Featured Photo */}
            <View style={styles.mainPhotoWrapper}>
              <Image
                source={{ uri: photos[selectedPhotoIdx] || photos[0] }}
                style={styles.mainPhoto}
                resizeMode="cover"
              />
              <View style={styles.speciesPill}>
                <Ionicons
                  name={pet.species === 'dog' ? 'paw' : 'sparkles'}
                  size={12}
                  color={TOKENS.colors.textInverse}
                />
                <Text style={styles.speciesPillText}>
                  {pet.species === 'dog' ? t.filterDogs : t.filterCats}
                </Text>
              </View>

              {/* Waiting badge */}
              {pet.waitingDays != null ? (
                <View
                style={[
                  styles.waitingFloatBadge,
                  isLongTerm ? styles.waitingFloatUrgent : styles.waitingFloatNormal,
                ]}
              >
                <Ionicons
                  name={isLongTerm ? 'flame' : 'time-outline'}
                  size={12}
                  color={isLongTerm ? TOKENS.colors.textInverse : TOKENS.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.waitingFloatText,
                    isLongTerm ? styles.waitingFloatTextUrgent : styles.waitingFloatTextNormal,
                  ]}
                >
                  {t.waitingPrefix} {pet.waitingDays} {t.daysShort}
                </Text>
              </View>
              ) : null}

              </View>

            {/* Photo Thumbnails Gallery */}
            {photos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbScroll}
                contentContainerStyle={styles.thumbScrollContent}
              >
                {photos.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedPhotoIdx(idx)}
                    activeOpacity={0.75}
                    style={[
                      styles.thumbWrap,
                      selectedPhotoIdx === idx && styles.thumbWrapActive,
                    ]}
                  >
                    <Image source={{ uri: url }} style={styles.thumbImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Title & Basic Info */}
            <View style={styles.titleSection}>
              <View>
                <Text style={styles.petName}>{pet.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={TOKENS.colors.clayDark} />
                  <Text style={styles.metaText}>{pet.city}</Text>
                  {age ? <Text style={styles.metaText}>· {age}</Text> : null}
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaText}>{pet.shelter.name}</Text>
                </View>
              </View>

              {pet.status !== 'reserved' ? <TouchableOpacity
                style={styles.likeFab}
                onPress={() => {
                  onClose();
                  onLikeFromDetails?.(pet);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="heart" size={24} color={TOKENS.colors.textInverse} />
              </TouchableOpacity> : null}
            </View>

            {pet.status === 'reserved' ? <Text>{lang === 'lt' ? 'Rezervuotas' : 'Reserved'}</Text> : null}
            {pet.status === 'unknown' ? <Text>{lang === 'lt' ? 'Prieinamumas nepatvirtintas' : 'Availability unconfirmed'}</Text> : null}
            {bio ? <Text style={styles.bioText}>{bio}</Text> : null}
            {pet.url ? <Text accessibilityRole="link" onPress={() => Linking.openURL(pet.url)}>
              {lang === 'lt' ? 'Originalus skelbimas' : 'Original listing'}
            </Text> : null}
            {pet.fetchedAt ? <Text>{lang === 'lt' ? 'Šaltinis nuskaitytas' : 'Source fetched'}: {new Date(pet.fetchedAt).toLocaleString(lang)}</Text> : null}

            {/* Shelter info block */}
            <View style={styles.shelterBox}>
              <View style={styles.shelterBadgeRow}>
                <Ionicons name="home-outline" size={16} color={TOKENS.colors.mossDark} />
                <Text style={styles.shelterTitle}>{pet.shelter.name}</Text>
              </View>
              <Text style={styles.shelterDesc}>
                {[pet.shelter.address, pet.shelter.phone, pet.shelter.email].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 35, 29, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: TOKENS.colors.cardSurface,
    borderTopLeftRadius: TOKENS.radii.modal,
    borderTopRightRadius: TOKENS.radii.modal,
    maxHeight: '88%',
    paddingBottom: 24,
    borderWidth: 1.5,
    borderColor: TOKENS.colors.cardBorder,
    ...TOKENS.shadows.card,
  },
  headerBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: TOKENS.colors.sandDeep,
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: TOKENS.radii.pill,
    backgroundColor: TOKENS.colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  mainPhotoWrapper: {
    height: 240,
    borderRadius: TOKENS.radii.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: TOKENS.colors.sandDeep,
    marginBottom: 10,
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
  },
  speciesPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.colors.moss,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: TOKENS.radii.pill,
  },
  speciesPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.textInverse,
  },
  waitingFloatBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: TOKENS.radii.pill,
  },
  waitingFloatUrgent: {
    backgroundColor: TOKENS.colors.terracotta,
  },
  waitingFloatNormal: {
    backgroundColor: 'rgba(232, 220, 199, 0.9)',
  },
  waitingFloatText: {
    fontSize: 11,
    fontWeight: '700',
  },
  waitingFloatTextUrgent: {
    color: TOKENS.colors.textInverse,
  },
  waitingFloatTextNormal: {
    color: TOKENS.colors.textPrimary,
  },
  thumbScroll: {
    marginBottom: 14,
  },
  thumbScrollContent: {
    gap: 8,
  },
  thumbWrap: {
    width: 58,
    height: 58,
    borderRadius: TOKENS.radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbWrapActive: {
    borderColor: TOKENS.colors.terracotta,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.sandDeep,
  },
  petName: {
    fontSize: 26,
    fontFamily: TOKENS.typography.title.fontFamily,
    fontWeight: '700',
    color: TOKENS.colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: TOKENS.colors.textSecondary,
    fontWeight: '500',
  },
  metaDivider: {
    marginHorizontal: 5,
    color: TOKENS.colors.textMuted,
  },
  likeFab: {
    width: 50,
    height: 50,
    borderRadius: TOKENS.radii.pill,
    backgroundColor: TOKENS.colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    ...TOKENS.shadows.button,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.colors.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  medicalWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  medPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TOKENS.colors.sand,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
  },
  medPillActive: {
    backgroundColor: TOKENS.colors.mossBg,
    borderColor: TOKENS.colors.sageLight,
  },
  medText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.textMuted,
  },
  medTextActive: {
    color: TOKENS.colors.mossDark,
  },
  traitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TOKENS.colors.mossBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.pill,
  },
  traitText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.colors.mossDark,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TOKENS.colors.sand,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.colors.textSecondary,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 20,
    color: TOKENS.colors.textSecondary,
  },
  shelterBox: {
    backgroundColor: TOKENS.colors.sand,
    borderRadius: TOKENS.radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
    marginBottom: 20,
  },
  shelterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  shelterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.colors.textPrimary,
  },
  shelterDesc: {
    fontSize: 12,
    color: TOKENS.colors.textMuted,
    lineHeight: 17,
  },
});
