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

  // ✅ FAVORİLERİ GETİRME FONKSİYONU (ProfileScreen içinde)
  const getFavorites = async (userId, type) => {
    try {
      const response = await axios.get(`http://139.179.207.16:8765/favorite/user/${userId}/${type}`);
      return response.data;
    } catch (error) {
      console.error('❌ Favori ${type} getirme hatası:', error);
      return [];
    }
  };

  // ✅ FAVORİ EKLEME FONKSİYONU
  const addFavorite = async (userId, spotifyId, type) => {
    try {
      await axios.post("http://139.179.207.16:8765/favorite/add-favorite", {
        userId,
        spotifyId,
        type,
      });
      console.log(`✅ Başarıyla eklendi: ${type} - ${spotifyId}`);
    } catch (error) {
      console.error("❌ Favori eklenirken hata oluştu:", error);
    }
  };

  const fetchProfileAndFavorites = async () => {
    try {
      console.log("⏳ Kullanıcı profili çekiliyor...");
      
      // ✅ Kullanıcı bilgilerini getir
      const userData = await getUserProfile(userId);
      console.log("👤 Kullanıcı Profili API Yanıtı:", userData);
  
      if (!userData || Object.keys(userData).length === 0) {
        throw new Error("❌ Kullanıcı bilgisi alınamadı.");
      }
  
      console.log("⏳ Kullanıcı favorileri çekiliyor...");
  
      // ✅ Favori Albümleri getir
      let favoriteAlbumsData = await getFavorites(userId, "album");
      console.log("🎵 Favori Albümler:", favoriteAlbumsData);
  
      // ✅ Favori Sanatçıları getir
      let favoriteArtistsData = await getFavorites(userId, "artist");
      console.log("🎤 Favori Sanatçılar:", favoriteArtistsData);
  
      // **TEK BİR `setProfile` ÇAĞRISI YAP**
      setProfile({
        username: userData.username || "Unknown",
        bio: userData.bio || "No bio available",
        location: userData.location || "Unknown location",
        link: userData.link || "Unknown link",
        profileImage: userData.profileImage || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        favoriteAlbums: favoriteAlbumsData.length > 0 ? favoriteAlbumsData : Array(4).fill(null),
        favoriteArtists: favoriteArtistsData.length > 0 ? favoriteArtistsData : Array(4).fill(null),
      });
  
    } catch (error) {
      console.error("❌ Kullanıcı veya Favoriler Alınamadı:", error);
    }
  };
  
  // **useEffect İçinde Çalıştır**
  useEffect(() => {
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
        <Text style={styles.username}>{profile.username}</Text>
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.locationLinkContainer}>
            <Text style={styles.location}>
              <Ionicons name="location-outline" size={16} color="gray" /> {profile.location}
            </Text>
            <Text style={styles.separator}> | </Text>
            <Text style={styles.link}>
              <Ionicons name="link-outline" size={16} color="gray" /> {profile.link}
            </Text>
          </View>
      </View>

      <View style={styles.separator} />
      <Text style={styles.favoriteTitle}>FAVORITE ALBUMS</Text>
      <View style={styles.gridContainer}>
        {profile.favoriteAlbums.map((album, index) => (
          <TouchableOpacity key={index} onPress={() => { setSelectedCategory("albums"); setSelectedIndex(index); setModalVisible(true); }}>
            {album ? (
              <Image source={{ uri: album.images?.[0]?.url || "" }} style={styles.album} />
            ) : (
              <View style={styles.emptyAlbum}><Ionicons name="add" size={40} color="white" /></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.separator} />
      <Text style={styles.favoriteTitle}>FAVORITE ARTISTS</Text>
      <View style={styles.gridContainer}>
        {profile.favoriteArtists.map((artist, index) => (
          <TouchableOpacity key={index} onPress={() => { setSelectedCategory("artists"); setSelectedIndex(index); setModalVisible(true); }}>
            {artist ? (
              <Image source={{ uri: artist.images?.[0]?.url || "" }} style={styles.artist} />
            ) : (
              <View style={styles.emptyArtist}><Ionicons name="add" size={40} color="white" /></View>
            )}
          </TouchableOpacity>
        ))}
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
  profileImage: { width: 80, height: 80, borderRadius: 40, marginRight: 15 },

  profileDetails: {
    alignItems: "flex-start",
    paddingHorizontal: 15,
    marginTop: -10,
  },
  username: { fontSize: 18, fontWeight: "bold", color: "white" },
  bio: { fontSize: 14, color: "white", marginVertical: 5 },

  locationLinkContainer: { flexDirection: "row", alignItems: "center" },
  location: { fontSize: 14, color: "white" },
  link: { fontSize: 14, color: "green" },
  separator: { fontSize: 14, color: "gray", marginHorizontal: 5 },
  link: { fontSize: 14, color: "#1DB954" },

  statsContainer: {
    flexDirection: "row",
    marginLeft: "auto",
    alignItems: "center",
  },
  statItem: { alignItems: "center", marginHorizontal: 10 },
  statNumber: { fontSize: 18, fontWeight: "bold", color: "white" },
  statLabel: { fontSize: 12, color: "gray" },

  separatorLine: { height: 1, backgroundColor: "gray", marginVertical: 20 },

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
