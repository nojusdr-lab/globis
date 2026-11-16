import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHELTERS, CITIES } from '../data/shelters';
import { TOKENS } from '../theme/tokens';
import { TRANSLATIONS } from '../data/translations';

export default function SheltersView({
  lang,
  onSelectShelterPets,
}) {
  const [selectedCity, setSelectedCity] = useState('all');
  const t = TRANSLATIONS[lang];

  const filteredShelters = selectedCity === 'all'
    ? SHELTERS
    : SHELTERS.filter((s) => s.city && s.city.toLowerCase() === selectedCity.toLowerCase());

  const totalAnimals = SHELTERS.reduce((acc, s) => acc + (s.totalCount || 0), 0);

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email, shelterName) => {
    if (!email) return;
    const subject = encodeURIComponent(
      lang === 'lt'
        ? `Užklausa dėl gyvūnų globos („Myliu tave“ - ${shelterName})`
        : `Inquiry regarding animal adoption ("Myliu tave" - ${shelterName})`
    );
    Linking.openURL(`mailto:${email}?subject=${subject}`);
  };

  const handleWebsite = (url) => {
    if (!url) return;
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(finalUrl);
  };

  return (
    <View style={styles.container}>
      {/* Overview Stats Header */}
      <View style={styles.headerStatsCard}>
        <View style={styles.statsIconWrap}>
          <Ionicons name="home" size={20} color={TOKENS.colors.textInverse} />
        </View>
        <View style={styles.statsTextWrap}>
          <Text style={styles.statsTitle}>{t.sheltersHeaderTitle}</Text>
          <Text style={styles.statsSubtitle}>
            {SHELTERS.length} {lang === 'lt' ? 'Lietuvos prieglaudos' : 'Lithuanian shelters'} · {totalAnimals} {lang === 'lt' ? 'aktyvūs Globis skelbimai' : 'active Globis listings'}
          </Text>
        </View>
      </View>

      {/* City Filter Pills */}
      <View style={styles.cityFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityScrollContent}
        >
          {CITIES.map((city) => {
            const isSelected = selectedCity.toLowerCase() === city.id.toLowerCase();
            const cityName = lang === 'lt' ? city.nameLt : city.nameEn;
            return (
              <TouchableOpacity
                key={city.id}
                style={[
                  styles.cityChip,
                  isSelected && styles.cityChipActive,
                ]}
                onPress={() => setSelectedCity(city.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.cityChipName,
                    isSelected && styles.cityChipNameActive,
                  ]}
                >
                  {cityName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Shelter List */}
      <FlatList
        data={filteredShelters}
        keyExtractor={(item) => item.id || item.slug}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const desc = lang === 'lt' ? item.descriptionLt : item.descriptionEn;
          const hasLogo = Boolean(item.logo && item.logo.startsWith('http'));

          return (
            <View style={styles.shelterCard}>
              {/* Top Row: Logo / Icon, Name and City */}
              <View style={styles.shelterTop}>
                {hasLogo ? (
                  <Image
                    source={{ uri: item.logo }}
                    style={styles.shelterLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.shelterIconPlaceholder}>
                    <Ionicons name="paw" size={16} color={TOKENS.colors.clayDark} />
                  </View>
                )}

                <View style={styles.nameBlock}>
                  <Text style={styles.shelterName}>{item.name}</Text>
                  {item.address ? (
                    <View style={styles.addressLine}>
                      <Ionicons name="location-outline" size={13} color={TOKENS.colors.clayDark} />
                      <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cityPill}>
                  <Text style={styles.cityPillText}>{item.city}</Text>
                </View>
              </View>

              {/* Animal Counts Pills: Dogs, Cats, Total */}
              <View style={styles.countsRow}>
                <View style={styles.countBadgeDog}>
                  <Ionicons name="paw" size={13} color={TOKENS.colors.ochreDark} />
                  <Text style={styles.countBadgeDogText}>
                    {item.dogsCount || 0} {t.dogsCountLabel}
                  </Text>
                </View>

                <View style={styles.countBadgeCat}>
                  <Ionicons name="sparkles" size={13} color={TOKENS.colors.sageDark} />
                  <Text style={styles.countBadgeCatText}>
                    {item.catsCount || 0} {t.catsCountLabel}
                  </Text>
                </View>

                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>
                    {item.totalCount || item.count || 0} {lang === 'lt' ? 'iš viso' : 'total'}
                  </Text>
                </View>
              </View>

              {item.totalCount === 0 && (
                <Text style={styles.descText}>{lang === 'lt' ? 'Šiuo metu nėra aktyvių Globis skelbimų' : 'No active Globis listings'}</Text>
              )}
              {/* Short Shelter Story */}
              {desc ? (
                <Text style={styles.descText} numberOfLines={2}>
                  {desc}
                </Text>
              ) : null}

              {/* Action Buttons: Call, Email, Website, Show Pets */}
              <View style={styles.actionsRow}>
                {item.phone ? (
                  <TouchableOpacity
                    style={styles.actionBtnCall}
                    onPress={() => handleCall(item.phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={13} color={TOKENS.colors.textInverse} />
                    <Text style={styles.actionBtnCallText}>{t.callShelter}</Text>
                  </TouchableOpacity>
                ) : null}

                {item.email ? (
                  <TouchableOpacity
                    style={styles.actionBtnEmail}
                    onPress={() => handleEmail(item.email, item.name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mail" size={13} color={TOKENS.colors.textPrimary} />
                    <Text style={styles.actionBtnEmailText}>{t.emailShelter}</Text>
                  </TouchableOpacity>
                ) : null}

                {(item.website || item.url) ? (
                  <TouchableOpacity
                    style={styles.actionBtnWeb}
                    onPress={() => handleWebsite(item.website || item.url)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="globe-outline" size={13} color={TOKENS.colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}

                {item.rosterCount > 0 && (
                  <TouchableOpacity
                    style={styles.actionBtnPets}
                    onPress={() => onSelectShelterPets?.(item.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionBtnPetsText}>{t.filterByThisShelter}</Text>
                    <Ionicons name="chevron-forward" size={12} color={TOKENS.colors.terracottaDark} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  headerStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.colors.cardSurface,
    borderRadius: TOKENS.radii.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: TOKENS.colors.cardBorder,
    ...TOKENS.shadows.button,
  },
  statsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: TOKENS.radii.pill,
    backgroundColor: TOKENS.colors.moss,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statsTextWrap: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 15,
    fontFamily: TOKENS.typography.title.fontFamily,
    fontWeight: '700',
    color: TOKENS.colors.textPrimary,
  },
  statsSubtitle: {
    fontSize: 11,
    color: TOKENS.colors.textSecondary,
    marginTop: 1,
  },
  cityFilterContainer: {
    marginBottom: 10,
  },
  cityScrollContent: {
    gap: 6,
    paddingVertical: 2,
  },
  cityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: TOKENS.radii.pill,
    backgroundColor: TOKENS.colors.cardSurface,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
  },
  cityChipActive: {
    backgroundColor: TOKENS.colors.terracotta,
    borderColor: TOKENS.colors.terracottaDark,
  },
  cityChipName: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.colors.textSecondary,
  },
  cityChipNameActive: {
    color: TOKENS.colors.textInverse,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  shelterCard: {
    backgroundColor: TOKENS.colors.cardSurface,
    borderRadius: TOKENS.radii.xl,
    padding: 14,
    borderWidth: 1.5,
    borderColor: TOKENS.colors.cardBorder,
    ...TOKENS.shadows.card,
  },
  shelterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shelterLogo: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.md,
    marginRight: 10,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
  },
  shelterIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.sandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  shelterName: {
    fontSize: 15,
    fontFamily: TOKENS.typography.title.fontFamily,
    fontWeight: '700',
    color: TOKENS.colors.textPrimary,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  addressText: {
    fontSize: 11,
    color: TOKENS.colors.textMuted,
    flex: 1,
  },
  cityPill: {
    backgroundColor: TOKENS.colors.ochreBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: TOKENS.colors.ochreLight,
  },
  cityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.ochreDark,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  countBadgeDog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.colors.sandDeep,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TOKENS.radii.pill,
  },
  countBadgeDogText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.ochreDark,
  },
  countBadgeCat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.colors.sageBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TOKENS.radii.pill,
  },
  countBadgeCatText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.sageDark,
  },
  totalBadge: {
    backgroundColor: TOKENS.colors.oat,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: TOKENS.radii.pill,
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: TOKENS.colors.textSecondary,
  },
  descText: {
    fontSize: 12,
    lineHeight: 17,
    color: TOKENS.colors.textSecondary,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.sandDeep,
  },
  actionBtnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.colors.terracotta,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.pill,
  },
  actionBtnCallText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.textInverse,
  },
  actionBtnEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.colors.oat,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: TOKENS.colors.sandDeep,
  },
  actionBtnEmailText: {
    fontSize: 11,
    fontWeight: '600',
    color: TOKENS.colors.textPrimary,
  },
  actionBtnWeb: {
    padding: 6,
    backgroundColor: TOKENS.colors.sandDeep,
    borderRadius: TOKENS.radii.pill,
  },
  actionBtnPets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
    backgroundColor: TOKENS.colors.terracottaBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: TOKENS.radii.pill,
  },
  actionBtnPetsText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.colors.terracottaDark,
  },
});
