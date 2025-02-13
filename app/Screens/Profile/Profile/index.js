import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getUserProfile } from "../../../api/backend";
import { getAccessToken, searchArtists, searchAlbums } from "../../../api/spotify";
import axios from "axios"; // API çağrıları için axios ekliyoruz.
import { ImageBackground } from "react-native";

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
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("albums");
  const [selectedIndex, setSelectedIndex] = useState(null);

  // ✅ FAVORİ EKLEME FONKSİYONU
  const addFavorite = async (userId, spotifyId, type) => {
    try {
      await axios.post("http://172.20.10.8:8765/favorite/add-favorite", {
        userId,
        spotifyId,
        type,
      });
      console.log(`✅ Başarıyla eklendi: ${type} - ${spotifyId}`);
    } catch (error) {
      console.error("❌ Favori eklenirken hata oluştu:", error);
    }
  };

  // ✅ Kullanıcının favori albüm ve sanatçılarının fotoğraflarını çekme fonksiyonu
  const getUserFavoritesImages = async (accessToken, userId) => {
    try {
      console.log(`🔍 Favoriler çekiliyor: userId=${userId}`);

      const response = await axios.get(`http://172.20.10.8:8765/favorite/user/${userId}/all`);
      const favorites = response.data;

      if (!favorites.length) {
        console.log("ℹ Kullanıcının favorisi yok.");
        return [];
      }

      console.log("✅ Favoriler alındı:", favorites);

      // API çağrısı ile her albüm ve sanatçının fotoğrafını çek
      const fetchImage = async (type, spotifyId) => {
        const url = `https://api.spotify.com/v1/${type}s/${spotifyId}`;
        console.log(`🔄 Spotify'dan çekiliyor: ${url}`);

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          console.error(`❌ Spotify API hatası: ${response.status}`);
          return null;
        }

        const data = await response.json();
        console.log(`✅ Spotify API Yanıtı (${type} - ${spotifyId}):`, data);

        return {
          id: spotifyId,
          name: data.name,
          image: data.images?.[0]?.url || null,
          type,
        };
      };

      const images = await Promise.all(favorites.map(({ type, spotifyId }) => fetchImage(type, spotifyId)));

      console.log("✅ Favori görselleri çekildi:", images);

      return images;
    } catch (error) {
      console.error("❌ Kullanıcının favori görselleri alınamadı:", error.response ? error.response.data : error.message);
      return [];
    }
  };

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

        // Albüm ve sanatçıları ayrıştır
        const favoriteAlbumsData = images.filter(fav => fav.type === "album");
        const favoriteArtistsData = images.filter(fav => fav.type === "artist");

        // Kullanıcı profilini ve favorileri güncelle
        setProfile(prevProfile => ({
          ...prevProfile, // ✅ Önceki state'i koruyoruz
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

  const handleSelectItem = async (item) => {
    const updatedProfile = { ...profile };

    if (selectedCategory === "artists") {
      updatedProfile.favoriteArtists[selectedIndex] = item;
      await addFavorite(userId, item.id, "artist"); // Backend'e kaydet
    } else {
      updatedProfile.favoriteAlbums[selectedIndex] = item;
      await addFavorite(userId, item.id, "album"); // Backend'e kaydet
    }

    setProfile(updatedProfile);
    setModalVisible(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/Screens/Profile/AuthenticationSettings")}>
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
          <TouchableOpacity style={styles.statItem} onPress={() => console.log("Reviews clicked")}>
            <Text style={styles.statNumber}>{Math.floor(Math.random() * 100)}</Text>
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

      <View style={styles.separator} />
      <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
      <View style={styles.gridContainer}>
        {[...profile.favoriteAlbums, ...Array(4 - profile.favoriteAlbums.length).fill(null)].map((album, index) => (
          <TouchableOpacity key={index} onPress={() => { setSelectedCategory("albums"); setSelectedIndex(index); setModalVisible(true); }}>
            {album ? (
              <>
                <Text style={{ color: "white", fontSize: 12 }}>{album.name}</Text>
                <Image
                  source={{ uri: album.image }}
                  style={styles.album}
                  resizeMode="cover"
                  onError={(e) => console.warn(`⚠ Image Load Warning for ${album.name}:`, e.nativeEvent.error)}
                />
              </>
            ) : (
              <View style={styles.emptyAlbum}>
                <Ionicons name="add" size={40} color="white" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.separator} />
      <Text style={styles.favoriteTitle}>FAVORITE ARTISTS</Text>
      <View style={styles.gridContainer}>
        {[...profile.favoriteArtists, ...Array(4 - profile.favoriteArtists.length).fill(null)].map((artist, index) => (
          <TouchableOpacity key={index} onPress={() => { setSelectedCategory("artists"); setSelectedIndex(index); setModalVisible(true); }}>
            {artist ? (
              <>
                <Text style={{ color: "white", fontSize: 12 }}>{artist.name}</Text>
                <Image
                  source={{ uri: artist.image }}
                  style={styles.artist}
                  resizeMode="cover"
                  onError={(e) => console.warn(`⚠ Image Load Warning for ${artist.name}:`, e.nativeEvent.error)}
                />
              </>
            ) : (
              <View style={styles.emptyArtist}>
                <Ionicons name="add" size={40} color="white" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.separator} />
      <Text style={styles.favoriteTitle}>REVIEWS</Text>
      <View style={styles.gridContainer}>
      </View>

      <Modal visible={modalVisible} animationType="fade" transparent={true}>
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
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  headerText: { fontSize: 24, color: "white" },

  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  profileImage: { width: 80, height: 80, borderRadius: 40, marginRight: 10 },

  profileDetails: {
    alignItems: "flex-start",
    paddingHorizontal: 15,
    marginTop: -10,
  },
  bioContainer: { marginLeft: 15 },

  username: { fontSize: 18, fontWeight: "bold", color: "white", marginVertical: 15 },
  bio: { fontSize: 14, color: "white", marginVertical: 5 },

  locationLinkContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  location: { fontSize: 14, color: "white" },
  link: { fontSize: 14, color: "green" },
  separator1: { fontSize: 14, color: "gray", marginHorizontal: 5 },
  link: { fontSize: 14, color: "#1DB954" },

  statsContainer: {
    flexDirection: "row",
    marginLeft: "auto",
    alignItems: "center",
  },
  profileInfoContainer: {
    flexDirection: "row", // Profil fotosu ve istatistikleri yan yana getirir
    alignItems: "center", // Dikeyde hizalar
    paddingHorizontal: 15,
    marginTop: 20,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "50%",  // Profil resmine göre hizalamak için genişlik ayarı
    marginLeft: 50, // Fotoğraftan biraz boşluk bırak
  },

  statItem: {
    alignItems: "center",
    marginHorizontal: 10, // Butonlar arasına mesafe ekleyelim
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
  searchModal: { width: "80%", backgroundColor: "#222", padding: 15, borderRadius: 10, alignItems: "center" },
  input: { color: "white", borderBottomWidth: 1, borderBottomColor: "white", marginBottom: 10 },
  resultText: { color: "white" },
  closeButton: { color: "white", textAlign: "center", fontSize: 16, marginTop: 10 },
  modalBackground: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  closeButton: { color: "white", textAlign: "center", fontSize: 16, marginTop: 10 },

  emptyArtist: {
    width: 80,
    height: 80,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 40,
    margin: 5,
  },
});