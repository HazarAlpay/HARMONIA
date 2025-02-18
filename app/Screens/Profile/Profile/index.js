import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getUserProfile } from "../../../api/backend";
import { getAccessToken, searchArtists, searchAlbums } from "../../../api/spotify";
import axios from "axios";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { debounce } from "lodash";

import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
} from "../../../constants/apiConstants";

export default function ProfileScreen() {
  const router = useRouter();
  const userId = 1; // Şu anlık sabit, dinamik yapılabilir.

  const [profile, setProfile] = useState({
    username: "",
    bio: "",
    location: "",
    link: "",
    profileImage: "",
    favoriteAlbums: Array(4).fill(null),
    favoriteArtists: Array(4).fill(null),
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("albums");
  const [selectedIndex, setSelectedIndex] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false); 
  const [albumImages, setAlbumImages] = useState({}); // Albüm resimlerini tutar
  const [loading, setLoading] = useState(true);
  const [likedReviews, setLikedReviews] = useState({});
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";

  // Spotify Access Token Alma
  const fetchSpotifyAccessToken = async () => {
    try {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      });

      const data = await response.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
      } else {
        console.error("❌ Spotify token alınamadı:", data);
      }
    } catch (error) {
      console.error("❌ Spotify token hatası:", error);
    }
  };

  // Sayfa açıldığında token al
  useEffect(() => {
    fetchSpotifyAccessToken();
  }, []);

  const toggleLike = (reviewId) => {
    setLikedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId], // Beğenildiyse kaldır, beğenilmediyse ekle
    }));
  };
  
  
  const fetchUsersReviews = async () => {
    try {
      console.log("🔍 Kullanıcının reviewları getiriliyor...");
      
      const response = await fetch(`http://192.168.1.102:8765/review/get-reviews/user/${userId}`);
      const data = await response.json();
      setReviews(data.content || []);
      setReviewCount(data.content ? data.content.length : 0);
      console.log("API Yanıtı:", data); // API yanıtını konsola yazdır

      // Albüm resimlerini çek
      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages(images);
      setLoading(false);
    } catch (error) {
      console.error("❌ Reviewları getirirken hata oluştu:", error);
      setLoading(false);
    }
  };
  
  // Sayfa açıldığında reviewları getir
  useEffect(() => {
    if (accessToken) {
      fetchUsersReviews();
    }
  }, [accessToken]);
  // 🔍 TEST: Reviewlar console'a yazdırılıyor mu?
useEffect(() => {
  console.log("📢 Güncellenen Reviews State:", reviews);
}, [reviews]); // Reviews değiştikçe log bas
  
  
  const fetchAlbumImages = async (reviewsData) => {
    let images = {};
    
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const response = await fetch(`${SPOTIFY_API_URL}/${review.spotifyId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
  
          if (!response.ok) {
            console.warn(`⚠ Spotify API hatası: ${response.status}`);
            images[review.spotifyId] = null;
            return;
          }
  
          const data = await response.json();
          images[review.spotifyId] = data.images?.[0]?.url || null;
  
          console.log(`✅ ${review.spotifyId} için resim bulundu:`, images[review.spotifyId]);
  
        } catch (error) {
            console.error(`❌ Albüm resmi çekme hatası (${review.spotifyId}):`, error);
            images[review.spotifyId] = null;
          }
        })
      );
  
    return images;
  };

  // Favori Ekleme
  const addFavorite = async (userId, spotifyId, type) => {
    try {
      await axios.post("http://192.168.1.102:8765/favorite/add-favorite", {
        userId,
        spotifyId,
        type,
      });
      console.log(`✅ Başarıyla eklendi: ${type} - ${spotifyId}`);
    } catch (error) {
      console.error("❌ Favori eklenirken hata oluştu:", error);
    }
  };

  // Kullanıcının Favori Görsellerini Alma
  const getUserFavoritesImages = async (accessToken, userId) => {
    try {
      console.log(`🔍 Favoriler çekiliyor: userId=${userId}`);

      const response = await axios.get(`http://192.168.1.102:8765/favorite/user/${userId}/all`);

      if (!response || !response.data || !Array.isArray(response.data)) {
        console.log("ℹ Kullanıcının favorisi bulunamadı veya geçersiz veri formatı.");
        return [];
      }

      const favorites = response.data;

      if (favorites.length === 0) {
        console.log("ℹ Kullanıcının favorisi yok.");
        return [];
      }

      console.log("✅ Favoriler başarıyla alındı:", favorites);

      const images = [];

      for (const favorite of favorites) {
        const { type, spotifyId } = favorite;

        if (!type || !spotifyId) {
          console.warn(`⚠ Geçersiz favori öğesi atlandı:`, favorite);
          continue;
        }

        try {
          const url = `https://api.spotify.com/v1/${type}s/${spotifyId}`;
          console.log(`🔄 Spotify'dan çekiliyor: ${url}`);

          const spotifyResponse = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!spotifyResponse.ok) {
            console.warn(`⚠ Spotify API hatası: ${spotifyResponse.status} - ${spotifyId}`);
            continue;
          }

          const data = await spotifyResponse.json();

          if (!data || !data.name) {
            console.warn(`⚠ Spotify'dan geçersiz veri geldi:`, data);
            continue;
          }

          images.push({
            id: spotifyId,
            name: data.name,
            image: data.images?.[0]?.url || null,
            type,
          });

          console.log(`✅ ${spotifyId} için resim başarıyla çekildi.`);
        } catch (error) {
          console.error(`❌ Spotify API çağrısı başarısız (${spotifyId}):`, error);
        }
      }

      console.log("✅ Favori görselleri başarıyla çekildi:", images);
      return images;
    } catch (error) {
      console.error("❌ Kullanıcının favori görselleri alınırken hata oluştu:", error);
      return [];
    }
  };

  // Profil ve Favorileri Çekme
  useEffect(() => {
    const fetchProfileAndFavorites = async () => {
      try {
        console.log("⏳ Kullanıcı profili çekiliyor...");
        const userData = await getUserProfile(userId);

        if (!userData) throw new Error("❌ Kullanıcı bilgisi alınamadı.");

        const token = await getAccessToken();
        setAccessToken(token);

        console.log("⏳ Kullanıcı favorileri ve görselleri çekiliyor...");
        const images = await getUserFavoritesImages(token, userId);

        console.log("✅ Favori görselleri çekildi:", images);

        const favoriteAlbumsData = images.filter(fav => fav.type === "album");
        const favoriteArtistsData = images.filter(fav => fav.type === "artist");

        setProfile(prevProfile => ({
          ...prevProfile,
          username: userData.username || "Unknown",
          bio: userData.bio || "No bio available",
          location: userData.location || "Unknown location",
          link: userData.link || "Unknown link",
          profileImage: userData.profileImage || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          favoriteAlbums: favoriteAlbumsData.length > 0 ? favoriteAlbumsData : prevProfile.favoriteAlbums,
          favoriteArtists: favoriteArtistsData.length > 0 ? favoriteArtistsData : prevProfile.favoriteArtists,
        }));

        console.log("✅ Güncellenmiş profil state:", profile);

      } catch (error) {
        console.error("❌ Kullanıcı veya favoriler alınamadı:", error);
      }
    };

    fetchProfileAndFavorites();
  }, []);

  // Access Token Çekme
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getAccessToken();
        console.log("🔑 Access Token:", token);
        setAccessToken(token);
      } catch (error) {
        console.error("❌ Error fetching access token:", error);
      }
    };
    fetchToken();
  }, []);

  // Arama İşlemi
  const handleSearch = debounce(async (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      let results;
      if (selectedCategory === "artists") {
        results = await searchArtists(accessToken, text);
      } else {
        results = await searchAlbums(accessToken, text);
      }
      setSearchResults(results);
    } catch (error) {
      console.error("Search Error:", error);
    }
  }, 500);

  // Arama Sonucu Seçme
  const handleSelectItem = async (item) => {
    const updatedProfile = { ...profile };

    if (selectedCategory === "artists") {
      updatedProfile.favoriteArtists[selectedIndex] = item;
      await addFavorite(userId, item.id, "artist");
    } else {
      updatedProfile.favoriteAlbums[selectedIndex] = item;
      await addFavorite(userId, item.id, "album");
    }

    setProfile(updatedProfile);
    setModalVisible(false);
  };

  const ReviewCard = ({
    review,
    albumImage,
    likedReviews,
    toggleLike,
    setModalVisible,
    setSelectedReviewId,
  }) => {
    const [isSwiped, setIsSwiped] = useState(false);
  
    const renderRightActions = () => (
      <View style={styles.deleteSwipeContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setSelectedReviewId(review.id);
            setModalVisible(true);
          }}
        >
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  
    return (
      <GestureHandlerRootView>
        <Swipeable
          renderRightActions={review.userId === 1 ? renderRightActions : null}
          overshootRight={false}
          onSwipeableWillOpen={() => setIsSwiped(true)}
          onSwipeableWillClose={() => setIsSwiped(false)}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#1E1E1E",
              margin: 10,
              marginRight: isSwiped ? 0 : 10,
              borderRadius: 10,
              padding: 10,
              alignItems: "center",
            }}
          >
            {albumImage ? (
              <Image source={{ uri: albumImage }} style={styles.albumCover} />
            ) : (
              <View style={[styles.albumCover, styles.placeholder]}>
                <Ionicons name="image-outline" size={40} color="gray" />
              </View>
            )}
  
            <View style={styles.reviewContent}>
              <Text style={styles.userName}>
                {review.username || `User ${review.userId}`}
              </Text>
              <Text style={styles.reviewDate}>
                {new Date(review.createdAt).toDateString()}
              </Text>
              <Text style={styles.reviewText}>{review.comment}</Text>
              <View style={styles.reviewFooter}>
                <View style={styles.rating}>
                  {[...Array(5)].map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < review.rating ? "star" : "star-outline"}
                      size={16}
                      color="#FFD700"
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={() => toggleLike(review.id)}>
                  <View style={styles.likeContainer}>
                    <Ionicons
                      name={likedReviews[review.id] ? "heart" : "heart-outline"}
                      size={20}
                      color={likedReviews[review.id] ? "red" : "white"}
                    />
                    <Text style={styles.likeText}>
                      {likedReviews[review.id] ? "23" : "22"} Likes
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Swipeable>
      </GestureHandlerRootView>
    ); 
    
  };
  

  return (
    <>
      <FlatList
        style={styles.container}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.headerText}>Profile</Text>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => router.push("/Screens/Profile/AuthenticationSettings")}
              >
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
  
            <View style={styles.profileInfoContainer}>
              {profile.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
              ) : (
                <Ionicons name="person-circle-outline" size={80} color="gray" />
              )}
              <View style={styles.statsContainer}>
                <TouchableOpacity style={styles.statItem} onPress={() => setReviewsModalVisible(true)}>
                  <Text style={styles.statNumber}>{reviewCount}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </TouchableOpacity>
  
                <TouchableOpacity style={styles.statItem} onPress={() => console.log("Following clicked")}>
                  <Text style={styles.statNumber}>{Math.floor(Math.random() * 500)}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
  
                <TouchableOpacity style={styles.statItem} onPress={() => console.log("Followers clicked")}>
                  <Text style={styles.statNumber}>{Math.floor(Math.random() * 1000)}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>
              </View>
            </View>
  
            {/* ✅ Bio ve Location Alanı */}
            <View style={styles.bioContainer}>
              <Text style={styles.username}>{profile.username}</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
              <View style={styles.locationLinkContainer}>
                <Text style={styles.location}>
                  <Ionicons name="location-outline" size={16} color="gray" /> {profile.location}
                </Text>
                <Text style={styles.separator1}> | </Text>
                <Text style={styles.link}>
                  <Ionicons name="link-outline" size={16} color="gray" /> {profile.link}
                </Text>
              </View>
            </View>
  
            {/* ✅ Favorite Albums */}
            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
            <View style={styles.gridContainer}>
              {[...profile.favoriteAlbums, ...Array(4 - profile.favoriteAlbums.length).fill(null)].map(
                (album, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setSelectedCategory("albums");
                      setSelectedIndex(index);
                      setSearchModalVisible(true);
                    }}
                  >
                    {album ? (
                      <>
                        <Text style={{ color: "white", fontSize: 12 }}>{album.name}</Text>
                        <Image
                          source={{ uri: album.image }}
                          style={styles.album}
                          resizeMode="cover"
                        />
                      </>
                    ) : (
                      <View style={styles.emptyAlbum}>
                        <Ionicons name="add" size={40} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
  
            {/* ✅ Favorite Artists */}
            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>FAVORITE ARTISTS</Text>
            <View style={styles.gridContainer}>
              {[...profile.favoriteArtists, ...Array(4 - profile.favoriteArtists.length).fill(null)].map(
                (artist, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setSelectedCategory("artists");
                      setSelectedIndex(index);
                      setSearchModalVisible(true);
                    }}
                  >
                    {artist ? (
                      <>
                        <Text style={{ color: "white", fontSize: 12 }}>{artist.name}</Text>
                        <Image
                          source={{ uri: artist.image }}
                          style={styles.artist}
                          resizeMode="cover"
                        />
                      </>
                    ) : (
                      <View style={styles.emptyArtist}>
                        <Ionicons name="add" size={40} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
  
            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>REVIEWS</Text>
          </>
        }
        
      />
  
      {/* ✅ Reviews Modal (Doğru Çalışan) */}
      <Modal visible={reviewsModalVisible} animationType="slide" transparent={true}>
  <View style={styles.modalBackground}>
    <View style={styles.reviewModal}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Reviews</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="white" />
      ) : reviews.length > 0 ? (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.reviewContainer}>
              {albumImages[item.spotifyId] ? (
                <Image source={{ uri: albumImages[item.spotifyId] }} style={styles.albumCover} />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="image-outline" size={40} color="gray" />
                </View>
              )}

              <View style={styles.reviewContent}>
                <Text style={styles.userName}>User {album.userId}</Text>
                <Text style={styles.reviewDate}>
                  {new Date(item.createdAt).toDateString()}
                </Text>
                <Text style={styles.reviewText}>{item.comment}</Text>

                <View style={styles.ratingContainer}>
                  {[...Array(5)].map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < item.rating ? "star" : "star-outline"}
                      size={16}
                      color="#FFD700"
                    />
                  ))}
                </View>

                <TouchableOpacity onPress={() => toggleLike(item.id)}>
                  <View style={styles.likeContainer}>
                    <Ionicons
                      name={likedReviews[item.id] ? "heart" : "heart-outline"}
                      size={20}
                      color={likedReviews[item.id] ? "red" : "white"}
                    />
                    <Text style={styles.likeText}>
                      {likedReviews[item.id] ? "Beğenildi" : "Beğen"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <Text style={{ color: "gray", textAlign: "center", marginTop: 10 }}>
          Henüz bir review yok.
        </Text>
      )}
    </View>
  </View>
</Modal>
  
      {/* ✅ Silme Modalı (Tamamen Çalışıyor) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.reviewModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Delete Review</Text>
            </View>
            <Text style={{ color: "white", textAlign: "center", marginBottom: 15 }}>
              Bu yorumu silmek istediğine emin misin?
            </Text>
  
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonYes]}
                onPress={() => handleDeleteReview(selectedReviewId)}
              >
                <Text style={styles.textStyle}>Evet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonNo]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.textStyle}>Hayır</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={searchModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.searchModal}>
            <TextInput style={styles.input} placeholder="Search..." onChangeText={handleSearch} value={searchText} />
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleSelectItem(item)} style={styles.resultItem}>
                  <Text style={styles.resultText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </>
  );
  
  

  

  // Modal Bileşeni
  const renderSearchModal = () => (
    <Modal visible={searchModalVisible} animationType="fade" transparent={true}>
      <View style={styles.modalBackground}>
        <View style={styles.searchModal}>
          <TextInput 
            style={styles.input} 
            placeholder="Search..." 
            onChangeText={handleSearch} 
            value={searchText} 
          />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelectItem(item)} style={styles.resultItem}>
                <Text style={styles.resultText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Profil Bilgileri Bileşeni
  const renderProfileInfo = () => (
    <View style={styles.profileInfoContainer}>
      {profile.profileImage ? (
        <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
      ) : (
        <Ionicons name="person-circle-outline" size={80} color="gray" />
      )}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statItem} onPress={() => console.log("Following clicked")}>
          <Text style={styles.statNumber}>{Math.floor(Math.random() * 500)}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statItem} onPress={() => console.log("Followers clicked")}>
          <Text style={styles.statNumber}>{Math.floor(Math.random() * 1000)}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Bio ve Lokasyon Bileşeni
  const renderBioAndLocation = () => (
    <View style={styles.bioContainer}>
      <Text style={styles.username}>{profile.username}</Text>
      <Text style={styles.bio}>{profile.bio}</Text>
      <View style={styles.locationLinkContainer}>
        <Text style={styles.location}>
          <Ionicons name="location-outline" size={16} color="gray" /> {profile.location}
        </Text>
        <Text style={styles.separator1}> | </Text>
        <Text style={styles.link}>
          <Ionicons name="link-outline" size={16} color="gray" /> {profile.link}
        </Text>
      </View>
    </View>
  );

  // Favori Albümler Bileşeni
  const renderFavoriteAlbums = () => (
    <>
      <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
      <View style={styles.gridContainer}>
        {[...profile.favoriteAlbums, ...Array(4 - profile.favoriteAlbums.length).fill(null)].map(
          (album, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setSelectedCategory("albums");
                setSelectedIndex(index);
                setSearchModalVisible(true);
              }}
            >
              {album ? (
                <>
                  <Text style={{ color: "white", fontSize: 12 }}>{album.name}</Text>
                  <Image
                    source={{ uri: album.image }}
                    style={styles.album}
                    resizeMode="cover"
                  />
                </>
              ) : (
                <View style={styles.emptyAlbum}>
                  <Ionicons name="add" size={40} color="white" />
                </View>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    </>
  );

  // Favori Sanatçılar Bileşeni
  const renderFavoriteArtists = () => (
    <>
      <Text style={styles.favoriteTitle}>FAVORITE ARTISTS</Text>
      <View style={styles.gridContainer}>
        {[...profile.favoriteArtists, ...Array(4 - profile.favoriteArtists.length).fill(null)].map(
          (artist, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setSelectedCategory("artists");
                setSelectedIndex(index);
                setSearchModalVisible(true);
              }}
            >
              {artist ? (
                <>
                  <Text style={{ color: "white", fontSize: 12 }}>{artist.name}</Text>
                  <Image
                    source={{ uri: artist.image }}
                    style={styles.artist}
                    resizeMode="cover"
                  />
                </>
              ) : (
                <View style={styles.emptyArtist}>
                  <Ionicons name="add" size={40} color="white" />
                </View>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    </>
  );

  // Ana Render
  return (
    <>
      <FlatList
        style={styles.container}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.headerText}>Profile</Text>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => router.push("/Screens/Profile/AuthenticationSettings")}
              >
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
  
            {renderProfileInfo()}
            {renderBioAndLocation()}
  
            <View style={styles.separator} />
            {renderFavoriteAlbums()}
  
            <View style={styles.separator} />
            {renderFavoriteArtists()}
  
            <View style={styles.separator} />
            <Text style={styles.favoriteTitle}>REVIEWS</Text>
          </>
        }
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            albumImage={albumImages[item.spotifyId]}
            likedReviews={likedReviews}
            toggleLike={toggleLike}
            setModalVisible={setModalVisible}
            setSelectedReviewId={setSelectedReviewId}
          />
        )}
      />
  
      {renderSearchModal()}
    </>
  );
}

// Stil Tanımları
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  headerText: { fontSize: 24, color: "white" },

  profileInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginTop: 20,
  },
  profileImage: { width: 80, height: 80, borderRadius: 40, marginRight: 10 },

  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "50%",
    marginLeft: 50,
  },

  statItem: {
    alignItems: "center",
    marginHorizontal: 10,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },

  statLabel: {
    fontSize: 12,
    color: "gray",
  },

  bioContainer: { marginLeft: 15 },

  username: { fontSize: 18, fontWeight: "bold", color: "white", marginVertical: 15 },
  bio: { fontSize: 14, color: "white", marginVertical: 5 },

  locationLinkContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  location: { fontSize: 14, color: "white" },
  link: { fontSize: 14, color: "#1DB954" },
  separator1: { fontSize: 14, color: "gray", marginHorizontal: 5 },

  separator: { height: 1, backgroundColor: "gray", marginVertical: 20 },

  favoriteTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    paddingLeft: 15,
  },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    flexWrap: "wrap",
    marginVertical: 10,
  },

  emptyAlbum: {
    width: 80,
    height: 80,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    margin: 5,
  },
  emptyArtist: {
    width: 80,
    height: 80,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    margin: 5,
  },

  searchModal: { width: "80%", backgroundColor: "#222", padding: 15, borderRadius: 10, alignItems: "center" },
  input: { color: "white", borderBottomWidth: 1, borderBottomColor: "white", marginBottom: 10 },
  resultText: { color: "white" },
  closeButton: { color: "white", textAlign: "center", fontSize: 16, marginTop: 10 },
  modalBackground: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },

  container: {
    flex: 1,
    backgroundColor: "black",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Arka planı koyu ve yarı saydam yap
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewModal: {
    width: '90%', // Modal genişliği
    maxHeight: '80%', // Modal yüksekliği
    backgroundColor: '#1E1E1E', // Modal arka plan rengi
    borderRadius: 10,
    padding: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  reviewContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholder: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
  },
  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  reviewDate: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 5,
  },
  reviewText: {
    fontSize: 14,
    color: 'lightgray',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeText: {
    color: 'white',
    marginLeft: 5,
  },
});