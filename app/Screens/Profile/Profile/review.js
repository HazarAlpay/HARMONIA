import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";
import axios from "axios";

export default function ReviewsScreen() {
  const router = useRouter();
  const userId = 1; // Kullanıcı ID

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchUserReviews = async () => {
      try {
        const response = await axios.get(`http://192.168.1.111:8765/review/get-reviews/user/${userId}`);
        setReviews(response.data.content || []);
      } catch (error) {
        console.error("❌ Reviewlar alınamadı:", error);
      }
    };
    
    fetchUserReviews();
  }, []);

  return (
    <View style={styles.container}>
      {/* Sayfa Başlığı ve Geri Butonu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Reviews</Text>
      </View>

      {/* Kullanıcının Tüm Reviewları */}
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.reviewContainer}>
            <Image source={{ uri: item.image || "https://via.placeholder.com/100" }} style={styles.reviewImage} />
            <View style={styles.reviewTextContainer}>
              <Text style={styles.reviewComment}>{item.comment}</Text>
              {/* Yıldız Sayısını Gösterme */}
              <View style={styles.ratingContainer}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons key={i} name={i < item.rating ? "star" : "star-outline"} size={16} color="#FFD700" />
                ))}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  backButton: {
    marginRight: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  reviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  reviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
  },
  reviewTextContainer: {
    flex: 1,
  },
  reviewComment: {
    fontSize: 14,
    color: "white",
  },
  ratingContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
});
