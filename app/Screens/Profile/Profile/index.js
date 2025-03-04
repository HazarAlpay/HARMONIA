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
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getUserProfile } from "../../../api/backend";
import { getAccessToken, searchArtists, searchAlbums } from "../../../api/spotify";
import axios from "axios";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { Linking } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { Keyboard } from "react-native";

import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
} from "../../../constants/apiConstants";

export default function ProfileScreen() {
  const router = useRouter();
  const userId = 3; //  Profilin sahibi (örneğin, görüntülenen profil) Şu anlık sabit
  const [currentUserId, setCurrentUserId] = useState(3); // Şu anki kullanıcı

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

  const [refreshing, setRefreshing] = useState(false); // Profil yenileme state
  const [reviewsRefreshing, setReviewsRefreshing] = useState(false); // Reviews modal yenileme state

  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followingModalVisible, setFollowingModalVisible] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false); 
  const [albumImages, setAlbumImages] = useState({}); // Albüm resimlerini tutar
  const [loading, setLoading] = useState(true);
  const [likedReviews, setLikedReviews] = useState({});
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";
  const SPOTIFY_ALBUM_API_URL = "https://api.spotify.com/v1/albums";
  const SPOTIFY_ARTIST_API_URL = "https://api.spotify.com/v1/artists";
  
  const BASE_URL = "http://172.20.10.8:8765";


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
  
  const handleDeleteReview = async (reviewId) => {
    try {
      const response = await fetch(
        `${BASE_URL}/review/delete/${reviewId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setReviews((prevReviews) => prevReviews.filter((review) => review.id !== reviewId));
        Alert.alert("Başarılı", "Review silindi.");
        setModalVisible(false); // Modal'ı kapat
        fetchUsersReviews(); // Silindikten sonra yenile
      } else {
        Alert.alert("Hata", "Review silinemedi.");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      Alert.alert("Error", "An error occurred while deleting the review");
    }
  };
  
  const fetchUsersReviews = async () => {
    try {
      setReviewsRefreshing(true);
      console.log("🔍 Kullanıcının reviewları getiriliyor...");
      
      const response = await fetch(`${BASE_URL}/review/get-reviews/user/${userId}`);
      const data = await response.json();
      setReviews(data.content || []);
      setReviewCount(data.content ? data.content.length : 0);
      console.log("API Yanıtı:", data); // API yanıtını konsola yazdır

      // Albüm adlarını Spotify API'sinden çek
    const reviewsWithAlbumNames = await Promise.all(
      data.content.map(async (review) => {
        try {
          const spotifyResponse = await fetch(`${SPOTIFY_API_URL}/${review.spotifyId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const spotifyData = await spotifyResponse.json();
          return {
            ...review,
            albumName: spotifyData.name, // Albüm adını ekle
          };
        } catch (error) {
          console.error(`❌ Albüm adı çekme hatası (${review.spotifyId}):`, error);
          return review;
        }
      })
    );

    setReviews(reviewsWithAlbumNames || []);
    setReviewCount(reviewsWithAlbumNames ? reviewsWithAlbumNames.length : 0);
    console.log("API Yanıtı:", reviewsWithAlbumNames);

      // Albüm resimlerini çek
      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages(images);
      setLoading(false);
    } catch (error) {
      console.error("❌ Reviewları getirirken hata oluştu:", error);
      setLoading(false);
    } finally {
      setReviewsRefreshing(false); // Yenileme tamamlandı
    }
  };
  
  // Sayfa açıldığında reviewları getir
  useEffect(() => {
    if (accessToken) {
      fetchUsersReviews();
    }
  }, [accessToken]);


  const onRefreshReviews = () => {
    fetchUsersReviews();
  };

  const onRefreshProfile = async () => {
    setRefreshing(true); // Yenileme işlemi başladı
    try {
      await fetchProfileAndFavorites(); // Profil ve favorileri yeniden çek
    } catch (error) {
      console.error("❌ Profil yenilenirken hata oluştu:", error);
    } finally {
      setRefreshing(false); // Yenileme işlemi tamamlandı
    }
  };

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
      await axios.post(`${BASE_URL}/favorite/add-favorite`, {
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
  
      // İki ayrı API çağrısı yap
    const [albumsResponse, artistsResponse] = await Promise.all([
      axios.get(`${BASE_URL}/favorite/user/${userId}/album?page=0`),
      axios.get(`${BASE_URL}/favorite/user/${userId}/artist?page=0`),
    ]);

    console.log("📌 API Yanıtları:", { albumsResponse, artistsResponse });

     // `data.content` dizisini alıyoruz
    const albums = Array.isArray(albumsResponse?.data?.content) ? albumsResponse.data.content : [];
    const artists = Array.isArray(artistsResponse?.data?.content) ? artistsResponse.data.content : [];

    // Favorileri birleştir
    const favorites = [...albums, ...artists];
  
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
          const url = type === "album" 
            ? `${SPOTIFY_ALBUM_API_URL}/${spotifyId}` 
            : `${SPOTIFY_ARTIST_API_URL}/${spotifyId}`;
          
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

    const favoriteAlbumsData = images.filter((fav) => fav.type === "album");
    const favoriteArtistsData = images.filter((fav) => fav.type === "artist");

    setProfile((prevProfile) => ({
      ...prevProfile,
      username: userData.username || "Unknown",
      bio: userData.bio || "No bio available",
      location: userData.location || "Unknown location",
      link: userData.link || "Unknown link",
      profileImage:
        userData.profileImage ||
        "https://cdn-icons-png.flaticon.com/512/149/149071.png",
      favoriteAlbums:
        favoriteAlbumsData.length > 0
          ? favoriteAlbumsData
          : prevProfile.favoriteAlbums,
      favoriteArtists:
        favoriteArtistsData.length > 0
          ? favoriteArtistsData
          : prevProfile.favoriteArtists,
    }));

    console.log("✅ Güncellenmiş profil state:", profile);
  } catch (error) {
    console.error("❌ Kullanıcı veya favoriler alınamadı:", error);
  }
};

useEffect(() => {
  fetchProfileAndFavorites();
}, []);

  useEffect(() => {
    const updateFavoritesImages = async () => {
      if (!accessToken) return; // Eğer token yoksa, işlem yapma
  
      console.log("🔄 Favoriler tekrar güncelleniyor...");
  
      const allFavorites = [...profile.favoriteAlbums, ...profile.favoriteArtists]
        .filter((fav) => fav && !fav.image); // Eğer favori var ama fotoğrafı yoksa
  
      if (allFavorites.length === 0) return;
  
      const updatedImages = await fetchFavoritesImages(allFavorites);
  
      setProfile((prevProfile) => ({
        ...prevProfile,
        favoriteAlbums: prevProfile.favoriteAlbums.map((album) =>
          album && !album.image ? { ...album, image: updatedImages[album.id] } : album
        ),
        favoriteArtists: prevProfile.favoriteArtists.map((artist) =>
          artist && !artist.image ? { ...artist, image: updatedImages[artist.id] } : artist
        ),
      }));
  
      console.log("✅ Eksik resimler güncellendi!");
    };
  
    updateFavoritesImages();
  }, [profile.favoriteAlbums, profile.favoriteArtists]);

  const openSpotify = (item) => {
    if (!item || !item.id) {
      console.error("❌ Geçersiz öğe:", item);
      return;
    }
  
    const url = item.type === "album"
      ? `https://open.spotify.com/album/${item.id}`
      : `https://open.spotify.com/artist/${item.id}`;
  
    Linking.openURL(url).catch((err) =>
      console.error("❌ Spotify açılırken hata oluştu:", err)
    );
  };

  const handleAlbumOrArtistPress = (index, category) => {
    if (currentUserId === userId) {
      // Kullanıcı kendi profilinde, search modalını aç
      setSelectedCategory(category);
      setSelectedIndex(index);
      setSearchModalVisible(true);
    } else {
      // Kullanıcı başka bir kullanıcının profilinde, resmi büyüt
      const item = category === "albums" ? profile.favoriteAlbums[index] : profile.favoriteArtists[index];
      setSelectedItem(item);
      setImageModalVisible(true);
    }
  };

  const [imageModalVisible, setImageModalVisible] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);

// Resmi büyütme modalı
const ImageModal = () => (
  <Modal visible={imageModalVisible} animationType="fade" transparent={true}>
    <View style={styles.imageModalBackground}>
      <TouchableOpacity style={styles.imageModalCloseButton} onPress={() => setImageModalVisible(false)}>
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
      <Image source={{ uri: selectedItem?.image }} style={styles.imageModalImage} />
      <Text style={styles.imageModalText}>{selectedItem?.name}</Text>
      
      {/* Spotify Butonu */}
      <TouchableOpacity
        style={styles.spotifyButton}
        onPress={() => openSpotify(selectedItem)}
      >
        <FontAwesome name="spotify" size={24} color="white" />
        <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
      </TouchableOpacity>
    </View>
  </Modal>
);
  

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

  useEffect(() => {
    if (searchModalVisible) { // Arama ekranı açıldığında
      setSearchText(""); // Arama metnini sıfırla
      setSearchResults([]); // Arama sonuçlarını sıfırla
    }
  }, [searchModalVisible]);

  // Arama İşlemi
  const handleSearch = async (text) => {
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
  };

  // Arama Sonucu Seçme
  const handleSelectItem = async (item) => {
    try {
      const updatedProfile = { ...profile };
  
      if (selectedCategory === "artists") {
        updatedProfile.favoriteArtists[selectedIndex] = item;
        await addFavorite(userId, item.id, "artist");
      } else {
        updatedProfile.favoriteAlbums[selectedIndex] = item;
        await addFavorite(userId, item.id, "album");
      }
  
      setProfile(updatedProfile);
      setSearchModalVisible(false); // Modal'ı kapat
    } catch (error) {
      console.error("Seçim yapılırken hata oluştu:", error);
    }
  };
  
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  const fetchFollowCounts = async () => {
    try {
      const followerResponse = await axios.get(`${BASE_URL}/user-follow/follower-count?userProfileId=1`);
      const followingResponse = await axios.get(`${BASE_URL}/user-follow/following-count?userProfileId=1`);
  
      console.log("📥 Follower Count Response:", followerResponse.data);
      console.log("📥 Following Count Response:", followingResponse.data);
  
      // Eğer backend doğru bir şekilde sayı döndürüyorsa, state'e ekleyelim
      setFollowerCount(typeof followerResponse.data === "number" ? followerResponse.data : 0);
      setFollowingCount(typeof followingResponse.data === "number" ? followingResponse.data : 0);
    } catch (error) {
      console.error("❌ API'den gelen hata:", error.response ? error.response.data : error.message);
    }
  };
  
  
  // useEffect ile bileşen açıldığında çağır
  useEffect(() => {
    fetchFollowCounts();
  }, []);

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  
  const fetchFollowers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/user-follow/followers?userId=1`);
      const text = await response.text(); // Önce yanıtı metin olarak al
      console.log("API Yanıtı:", text); // Yanıtı konsola yazdır
      const data = JSON.parse(text); // JSON'a çevir
      setFollowers(data);
    } catch (error) {
      console.error("❌ Takipçiler alınırken hata oluştu:", error);
    }
  };
  
  const fetchFollowing = async () => {
    try {
      const response = await fetch(`${BASE_URL}/user-follow/followings?userId=1`);
      const text = await response.text(); // Önce yanıtı metin olarak al
      console.log("API Yanıtı:", text); // Yanıtı konsola yazdır
      const data = JSON.parse(text); // JSON'a çevir
      setFollowing(data);
    } catch (error) {
      console.error("❌ Takip edilenler alınırken hata oluştu:", error);
    }
  };
  
  // useEffect ile bileşen açıldığında çağır
  useEffect(() => {
    fetchFollowers();
    fetchFollowing();
  }, []);
  
  

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
          renderRightActions={review.userId === currentUserId ? renderRightActions : null} //sadece currentuser yapabilmeli
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
                {review.albumName || `User ${review.spotifyId}`}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing} // Yenileme işlemi devam ediyorsa true, değilse false
            onRefresh={onRefreshProfile} // Yenileme işlemi tetiklendiğinde çağrılacak fonksiyon
            colors={["#1DB954"]} // iOS için refresh spinner rengi
            tintColor="#1DB954" // iOS için refresh spinner rengi
          />
        }
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
  
                <TouchableOpacity style={styles.statItem} onPress={() => setFollowingModalVisible(true)}>
                <Text style={styles.statNumber}>
                  {typeof followingCount === "number" ? followingCount : "0"}
                </Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
  
                <TouchableOpacity style={styles.statItem} onPress={() => setFollowersModalVisible(true)}>
                <Text style={styles.statNumber}>
                  {typeof followerCount === "number" ? followerCount : "0"}
                </Text>
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
                  onPress={() => handleAlbumOrArtistPress(index, "albums")}
                >
                  {album ? (
                    <>
                      <Image
                        source={{ uri: album.image }}
                        style={styles.album}
                        resizeMode="cover"
                      />
                      <Text style={{ color: "white", fontSize: 12, textAlign: "center" }}>{album.name}</Text>
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
          <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
          <View style={styles.gridContainer}>
            {[...profile.favoriteArtists, ...Array(4 - profile.favoriteArtists.length).fill(null)].map(
              (artist, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAlbumOrArtistPress(index, "artists")}
                >
                  {artist ? (
                    <>
                      <Image
                        source={{ uri: artist.image }}
                        style={styles.artist}
                        resizeMode="cover"
                      />
                      <Text style={{ color: "white", fontSize: 12, textAlign: "center" }}>{artist.name}</Text>
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
                  }     
                />

        {/* Followers Modal */}
        <Modal visible={followersModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalBackgroundFollow}>
            <View style={styles.modalContainerFollow}>
              <TouchableOpacity onPress={() => setFollowersModalVisible(false)} style={styles.closeButtonFollow}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitleFollow}>Followers</Text>
              <FlatList
                data={followers}
                keyExtractor={(item) => item.userId.toString()}
                renderItem={({ item }) => (
                  <View style={styles.userItemFollow}>
                    <Image source={{ uri: item.profileImage }} style={styles.userImageFollow} />
                    <Text style={styles.usernameFollow}>{item.username}</Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Following Modal */}
        <Modal visible={followingModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalBackgroundFollow}>
            <View style={styles.modalContainerFollow}>
              <TouchableOpacity onPress={() => setFollowingModalVisible(false)} style={styles.closeButtonFollow}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitleFollow}>Following</Text>
              <FlatList
                data={following}
                keyExtractor={(item) => item.userId.toString()}
                renderItem={({ item }) => (
                  <View style={styles.userItemFollow}>
                    <Image source={{ uri: item.profileImage }} style={styles.userImageFollow} />
                    <Text style={styles.usernameFollow}>{item.username}</Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>



          
              {/* ✅ Reviews Modal (Doğru Çalışan) */}
              <Modal visible={reviewsModalVisible} animationType="slide" transparent={true}>
              <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalText}>
                Are you sure you want to delete your review?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonYes]}
                  onPress={() => {
                    handleDeleteReview(selectedReviewId); // Review'u sil
                    setModalVisible(false); // Modal'ı kapat
                  }}
                >
                  <Text style={styles.textStyle}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonNo]}
                  onPress={() => setModalVisible(!modalVisible)}
                >
                  <Text style={styles.textStyle}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.modalBackground}>
          <View style={styles.reviewModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Reviews</Text>
            </View>

            {reviewsRefreshing ? (
              <ActivityIndicator size="large" color="white" />
            ) : reviews.length > 0 ? (
              <FlatList
                  data={reviews}
                  keyExtractor={(item) => item.id.toString()}
                  refreshControl={
                    <RefreshControl refreshing={reviewsRefreshing} onRefresh={onRefreshReviews} colors={["#1DB954"]} 
                    tintColor="#1DB954" />
                  }
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

            ) : (
              <Text style={{ color: "gray", textAlign: "center", marginTop: 10 }}>
                Henüz bir review yok.
              </Text>
            )}
          </View>
        </View>
      </Modal>
  
      

      <Modal visible={searchModalVisible} animationType="fade" transparent={true}>
      <View style={styles.modalBackground}>
        <View style={styles.searchModal}>
          {/* Modal Header */}
          <View style={styles.searchModalHeader}>
            <Text style={styles.searchModalTitle}>Search {selectedCategory === "albums" ? "Albums" : "Artists"}</Text>
            <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={20} color="gray" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="gray"
              onChangeText={handleSearch}
              value={searchText}
              autoFocus={true}
            />
          </View>

          {/* Search Results */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelectItem(item)} style={styles.resultItem}>
                <Image
                  source={{ uri: item.images?.[0]?.url || "https://via.placeholder.com/50" }}
                  style={styles.resultImage}
                />
                <Text style={styles.resultText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            onScroll={() => Keyboard.dismiss()} // Klavyeyi kapat
            scrollEventThrottle={16} // Scroll olayının sıklığını ayarla
            keyboardShouldPersistTaps="handled" // Klavyenin tıklamalarda kalmasını engelle
            ListEmptyComponent={
              <Text style={styles.noResultsText}>No results found.</Text>
            }
          />
        </View>
      </View>
    </Modal>

     {/* Image Modal */}
     <ImageModal />
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
    paddingHorizontal: 10,
    marginTop: 20,
  },
  profileImage: { width: 90, height: 90, borderRadius: 50, marginRight: 10 },

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
  album: {
    width: 90,
    height: 90,
    borderRadius: 5,
    margin: 5,
  },
  artist: {
    width: 90,
    height: 90,
    borderRadius: 40,
    margin: 5,
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

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)", // Daha koyu bir arka plan
  },
  searchModal: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#1E1E1E", // Modal arka plan rengi
    borderRadius: 15,
    padding: 15,
  },
  searchModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  closeButton: {
    padding: 5,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 16,
    paddingVertical: 10,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 10,
  },
  resultText: {
    fontSize: 16,
    color: "white",
  },
  noResultsText: {
    color: "gray",
    textAlign: "center",
    marginTop: 20,
  },

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
    marginTop:5,
  },
  reviewText: {
    fontSize: 14,
    color: 'lightgray',
    marginBottom: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  rating: {
    flexDirection: "row",
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop:5,
  },
  likeText: {
    color: 'white',
    marginLeft: 5,

  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: "40%",
    alignItems: "center",
  },
  buttonYes: {
    backgroundColor: "#FF0000",
  },
  buttonNo: {
    backgroundColor: "#2196F3",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  deleteSwipeContainer: {
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "red",
    width: 130,
    height: "75%",
    borderTopRightRadius: 10, // Rounded on the right
    borderBottomRightRadius: 10, // Rounded on the right
    borderTopLeftRadius: 0, // No border radius on the left
    borderBottomLeftRadius: 0, // No border radius on the left
    marginRight: 10,
  },
  deleteText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
    modalBackgroundFollow: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContainerFollow: {
      width: "80%",
      backgroundColor: "#222",
      padding: 20,
      borderRadius: 10,
      alignItems: "center",
    },
    modalTitleFollow: {
      fontSize: 18,
      fontWeight: "bold",
      color: "white",
      marginBottom: 10,
    },
    closeButtonFollow: {
      position: "absolute",
      top: 10,
      right: 10,
    },
    userItemFollow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 8,
    },
    userImageFollow: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 10,
    },
    usernameFollow: {
      fontSize: 16,
      color: "white",
    },

    imageModalBackground: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.9)",
    },
    imageModalCloseButton: {
      position: "absolute",
      top: 40,
      right: 20,
      zIndex: 1,
    },
    imageModalImage: {
      width: 300,
      height: 300,
      borderRadius: 10,
    },
    imageModalText: {
      fontSize: 24,
      color: "white",
      marginTop: 20,
    },
    spotifyButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1DB954", // Spotify yeşili
      padding: 10,
      borderRadius: 5,
      marginTop: 20,
    },
    spotifyButtonText: {
      color: "white",
      fontSize: 16,
      marginLeft: 10,
    },
});
