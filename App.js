import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { eligible, shelterPets } from './src/data/integrity.cjs';
import { PETS } from './src/data/pets';
import { TOKENS } from './src/theme/tokens';
import Header from './src/components/Header';
import CardStack from './src/components/CardStack';
import ActionButtons from './src/components/ActionButtons';
import MatchModal from './src/components/MatchModal';
import PetDetailsModal from './src/components/PetDetailsModal';
import LikesDrawer from './src/components/LikesDrawer';
import SheltersView from './src/components/SheltersView';
import GrainOverlay from './src/components/GrainOverlay';

const PAGE_SIZE = 20;

export default function App() {
  const [lang, setLang] = useState('lt');
  const [activeTab, setActiveTab] = useState('pets'); // 'pets' | 'shelters'
  const [shelterId, setShelterId] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'dog' | 'cat'
  const [isUrgent, setIsUrgent] = useState(false); // "Skubiausi" toggle
  const [cityFilter, setCityFilter] = useState('all'); // 11 Lithuanian cities + all
  const [deckLimit, setDeckLimit] = useState(PAGE_SIZE); // Smooth 20-cards-at-a-time pagination
  const [likedPets, setLikedPets] = useState([]);
  const [passedPets, setPassedPets] = useState([]);
  const [matchedPet, setMatchedPet] = useState(null);
  const [isMatchModalVisible, setIsMatchModalVisible] = useState(false);
  const [detailsPet, setDetailsPet] = useState(null);
  const [isLikesDrawerVisible, setIsLikesDrawerVisible] = useState(false);

  const stackRef = useRef(null);

  // Compute filtered & sorted pets list
  const filteredPets = useMemo(() => {
    let result = shelterId ? shelterPets(PETS, shelterId) : PETS.filter(eligible);

    // 1. Filter by species
    if (filter !== 'all') {
      result = result.filter((p) => p.species === filter);
    }

    // 2. Filter by city across all Lithuanian cities
    if (!shelterId && cityFilter !== 'all') {
      result = result.filter(
        (p) => p.city && p.city.toLowerCase() === cityFilter.toLowerCase()
      );
    }

    // 3. "Skubiausi" (Longest waiting) sort
    if (isUrgent) {
      result.sort((a, b) => (b.waitingDays || 0) - (a.waitingDays || 0));
    }

    return result;
  }, [filter, cityFilter, isUrgent, shelterId]);

  // Unique filter key used to safely reset pagination and stack index
  const filterKey = `${filter}-${cityFilter}-${isUrgent}-${shelterId}`;

  // Reset deck limit to 20 whenever filter criteria change
  useEffect(() => {
    setDeckLimit(PAGE_SIZE);
  }, [filterKey]);

  // Slice cards for smooth performance (loads 20 cards at a time as user swipes)
  const visiblePets = useMemo(() => {
    return filteredPets.slice(0, deckLimit);
  }, [filteredPets, deckLimit]);

  // Expand deck limit by PAGE_SIZE when user nears the end of current slice
  const handleLoadMore = () => {
    if (deckLimit < filteredPets.length) {
      setDeckLimit((prev) => Math.min(prev + PAGE_SIZE, filteredPets.length));
    }
  };

  // Handle Swipes
  const handleSwipeRight = (pet) => {
    if (!pet || !eligible(pet)) return;
    setLikedPets((prev) => {
      if (prev.some((p) => p.id === pet.id)) return prev;
      return [pet, ...prev];
    });
    setMatchedPet(pet);
    setIsMatchModalVisible(true);
  };

  const handleSwipeLeft = (pet) => {
    if (!pet) return;
    setPassedPets((prev) => [pet, ...prev]);
  };

  const handleRewind = () => {
    if (stackRef.current) {
      stackRef.current.rewind();
    }
  };

  const handlePass = () => {
    if (stackRef.current) {
      stackRef.current.swipeLeft();
    }
  };

  const handleLike = () => {
    if (stackRef.current) {
      stackRef.current.swipeRight();
    }
  };

  const handleInfo = () => {
    const current = stackRef.current?.getCurrentPet();
    if (current) {
      setDetailsPet(current);
    } else if (visiblePets.length > 0) {
      setDetailsPet(visiblePets[0]);
    }
  };

  const handleRemoveLike = (petId) => {
    setLikedPets((prev) => prev.filter((p) => p.id !== petId));
  };

  const handleResetStack = () => {
    setPassedPets([]);
    setDeckLimit(PAGE_SIZE);
  };

  const handleSelectShelterPets = (id) => {
    setShelterId(id);
    setFilter('all');
    setCityFilter('all');
    setActiveTab('pets');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={TOKENS.colors.sand}
      />

      {/* Tactile Organic Grain Overlay */}
      <GrainOverlay />

      <View style={styles.appContainer}>
        {/* Top Header: Brand, Language Toggle, Tab Switcher, Species + Skubiausi, City Bar */}
        <Header
          lang={lang}
          setLang={setLang}
          filter={filter}
          setFilter={setFilter}
          isUrgent={isUrgent}
          setIsUrgent={setIsUrgent}
          cityFilter={cityFilter}
          setCityFilter={(city) => { setShelterId(null); setCityFilter(city); }}
          likedCount={likedPets.length}
          onOpenLikes={() => setIsLikesDrawerVisible(true)}
          activeTab={activeTab}
          setActiveTab={(tab) => { setShelterId(null); setActiveTab(tab); }}
        />

        {/* View Switcher: Augintiniai (Cards) vs Prieglaudos (Shelters) */}
        {activeTab === 'pets' ? (
          <>
            {/* Swipeable Pet Card Stack with 20-card-at-a-time pagination */}
            <CardStack
              stackRef={stackRef}
              pets={visiblePets}
              totalCount={filteredPets.length}
              filterKey={filterKey}
              lang={lang}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              onOpenDetails={(pet) => setDetailsPet(pet)}
              onResetStack={handleResetStack}
              onOpenLikes={() => setIsLikesDrawerVisible(true)}
              likedCount={likedPets.length}
              onLoadMore={handleLoadMore}
            />

            {/* Action Controls: Rewind, Pass, Info, Like with Breathing Pulse */}
            <ActionButtons
              onRewind={handleRewind}
              onPass={handlePass}
              onInfo={handleInfo}
              onLike={handleLike}
              canRewind={true}
            />
          </>
        ) : (
          /* "Prieglaudos" Shelters Directory View across all 37 Lithuanian shelters */
          <SheltersView
            lang={lang}
            onSelectShelterPets={handleSelectShelterPets}
          />
        )}
      </View>

      {/* "Valio! Susisiekite su prieglauda" Modal on Swipe Right */}
      <MatchModal
        visible={isMatchModalVisible}
        pet={matchedPet}
        lang={lang}
        onClose={() => setIsMatchModalVisible(false)}
      />

      {/* Detailed Pet Profile & Shelter Inspection Sheet */}
      <PetDetailsModal
        visible={Boolean(detailsPet)}
        pet={detailsPet}
        lang={lang}
        onClose={() => setDetailsPet(null)}
        onLikeFromDetails={(pet) => {
          setDetailsPet(null);
          handleSwipeRight(pet);
        }}
      />

      {/* Saved Likes Drawer */}
      <LikesDrawer
        visible={isLikesDrawerVisible}
        likedPets={likedPets}
        lang={lang}
        onClose={() => setIsLikesDrawerVisible(false)}
        onSelectPet={(pet) => {
          setMatchedPet(pet);
          setIsMatchModalVisible(true);
        }}
        onRemoveLike={handleRemoveLike}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.colors.sand,
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.colors.sand,
    ...(Platform.OS === 'web'
      ? {
          height: '100vh',
          boxShadow: '0 0 30px rgba(43, 35, 29, 0.1)',
        }
      : {}),
  },
});
