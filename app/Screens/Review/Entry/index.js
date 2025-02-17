import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  BACKEND_REVIEW_URL,
} from "../../../constants/apiConstants";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/albums";

/*
  TODOs: 
  - Renkler ve stiller üzerinde geliştirmeler yapılacak. Daha estetik olsun
  - Review'lerin beğenilme özelliği backend ile bağlantı kurulacak
  - 3 tab eklenecek: friend reviews, popular reviews, your reviews
  - Filtreler eklenecek: en çok beğenilenler, en yeni, en eski
  - Reviewların üzerine tıklanınca detay sayfasına gidilecek, aşağı inilince o reviewa atılan yorumlar gösterilecek
  - Search field eklenecek
  - Kullanıcı aynı silme işleminde olduğu gibi reviewlarını editleyebilecek (sadece kendi reviewları)
  - Sayfa yenileme eklenecek slide down action ile
  - Mock data kaldırılacak
*/

export default function HomeScreen() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [likedReviews, setLikedReviews] = useState({});
  const [albumImages, setAlbumImages] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  useEffect(() => {
    fetchSpotifyAccessToken();
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchUsersReviews();
    }
  }, [accessToken]); // Fetch reviews only when token is available

  useFocusEffect(
    useCallback(() => {
      fetchUsersReviews();
      fetchAlbumImages(reviews);
    }, [])
  );

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
        console.error("Failed to fetch Spotify access token:", data);
      }
    } catch (error) {
      console.error("Error fetching Spotify token:", error);
    }
  };

  const fetchUsersReviews = async () => {
    try {
      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/get-reviews/user/1`
      ); // 1 yerine current kullanıcının id'si gelecek
      const data = await response.json();
      setReviews(data.content || []);

      // Fetch album images in batch
      const images = await fetchAlbumImages(data.content || []);
      setAlbumImages(images);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setLoading(false);
    }
  };

  const fetchAlbumImages = async (reviewsData) => {
    let images = {};
    await Promise.all(
      reviewsData.map(async (review) => {
        try {
          const response = await fetch(
            `${SPOTIFY_API_URL}/${review.spotifyId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          const data = await response.json();
          images[review.spotifyId] = data.images?.[0]?.url || null;
        } catch (error) {
          console.error(
            `Error fetching album image for ${review.spotifyId}:`,
            error
          );
          images[review.spotifyId] = null;
        }
      })
    );
    return images;
  };

  const toggleLike = (reviewId) => {
    setLikedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  const handleDeleteReview = async (reviewId) => {
    try {
      const response = await fetch(
        `${BACKEND_REVIEW_URL}/review/delete/${reviewId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setReviews((prevReviews) =>
          prevReviews.filter((review) => review.id !== reviewId)
        );
        setModalVisible(false);
      } else {
        Alert.alert("Error", "Failed to delete review");
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      Alert.alert("Error", "An error occurred while deleting the review");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
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
                onPress={() => handleDeleteReview(selectedReviewId)}
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
    </View>
  );
}

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

const styles = StyleSheet.create({
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

  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  reviewDate: {
    fontSize: 12,
    color: "gray",
    marginBottom: 5,
  },
  reviewText: {
    fontSize: 14,
    color: "lightgray",
  },
  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rating: {
    flexDirection: "row",
  },
  likeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeText: {
    color: "white",
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
});