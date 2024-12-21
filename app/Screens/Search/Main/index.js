import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Keyboard,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  getAccessToken,
  searchArtists,
  searchAlbums,
} from "../../../api/spotify";

export default function SearchScreen() {
  const [isFocused, setIsFocused] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedOption, setSelectedOption] = useState("Artists");
  const [searchResults, setSearchResults] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [offset, setOffset] = useState(0); // API'deki başlangıç noktası için offset
  const [isLoading, setIsLoading] = useState(false);

  const options = ["Artists", "Albums"];

  const handleCancel = () => {
    setSearchText("");
    setIsFocused(false);
    Keyboard.dismiss();
    setSearchResults([]);
    setOffset(0); // Reset offset
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setSearchResults([]);
    setOffset(0); // Reset offset
  };

  const fetchResults = async (text, loadMore = false) => {
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      let results;
      if (selectedOption === "Artists") {
        results = await searchArtists(accessToken, text, offset); // offset ekleniyor
      } else if (selectedOption === "Albums") {
        results = await searchAlbums(accessToken, text, offset); // offset ekleniyor
      }

      if (loadMore) {
        setSearchResults((prev) => [...prev, ...results]); // Daha fazla sonuç ekle
      } else {
        setSearchResults(results); // İlk sonuç seti
      }
    } catch (error) {
      console.error("Search Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (text) => {
    setOffset(0); // Arama yenilendiğinde offset sıfırlanır
    fetchResults(text);
  };

  const loadMoreResults = () => {
    if (!isLoading && searchText.trim()) {
      setOffset((prev) => prev + 10); // Offset'i artır
    }
  };

  useEffect(() => {
    if (searchText.trim()) {
      fetchResults(searchText);
    }
  }, [selectedOption]);

  useEffect(() => {
    if (offset > 0) {
      fetchResults(searchText, true); // Load more tetiklendiğinde daha fazla veri getir
    }
  }, [offset]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getAccessToken();
        setAccessToken(token);
      } catch (error) {
        console.error("Error fetching access token:", error);
      }
    };

    fetchToken();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        <View style={styles.searchWrapper}>
          <View
            style={[
              styles.searchContainer,
              isFocused && styles.searchContainerFocused,
            ]}
          >
            <Ionicons
              name="search-outline"
              size={24}
              color={isFocused ? "white" : "gray"}
              style={styles.icon}
            />
            <TextInput
              style={[
                styles.input,
                isFocused && { color: "white", backgroundColor: "#444" },
              ]}
              placeholder="Find artists, albums, people..."
              placeholderTextColor="gray"
              value={searchText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => !searchText && setIsFocused(false)}
              onChangeText={(text) => {
                setSearchText(text);
                handleSearch(text);
              }}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText("")}
                style={styles.clearButton}
              >
                <Ionicons name="close-outline" size={24} color="gray" />
              </TouchableOpacity>
            )}
          </View>

          {isFocused && (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {isFocused && (
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  selectedOption === option && styles.selectedOption,
                ]}
                onPress={() => handleOptionSelect(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedOption === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.resultsContainer}>
        <FlatList
          data={searchResults}
          keyExtractor={(item, index) => `${item.id}-${index}`} // Benzersiz key
          renderItem={({ item }) => (
            <View style={styles.resultItem}>
              <Image
                source={{ uri: item.images?.[0]?.url }}
                style={[
                  styles.image,
                  selectedOption === "Artists" ? styles.artistImage : null,
                ]}
              />
              <Text style={styles.resultText}>{item.name}</Text>
            </View>
          )}
          numColumns={2}
          contentContainerStyle={styles.resultsList}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          onEndReached={loadMoreResults} // Kullanıcı liste sonuna ulaştığında çalışır
          onEndReachedThreshold={0.5} // Eşik değer
          ListFooterComponent={
            isLoading ? (
              <Text style={styles.loadingText}>Loading...</Text>
            ) : null
          } // Yükleniyor göstergesi
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  topContainer: {
    backgroundColor: "#1E1E1E", // Arka plan farklı rengi
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10, // Alt boşluk
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E2E2E",
    borderRadius: 15,
    paddingHorizontal: 10,
    height: 40,
    flex: 1,
  },
  searchContainerFocused: {
    backgroundColor: "#444",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 16,
    backgroundColor: "#2E2E2E",
    borderRadius: 8,
    paddingRight: 35,
  },
  clearButton: {
    position: "absolute",
    right: 10,
  },
  cancelButton: {
    marginLeft: 10,
  },
  cancelText: {
    color: "white",
    fontSize: 16,
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 10,
    marginBottom: 0, // Alt boşluk eklendi
  },
  option: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedOption: {
    backgroundColor: "white",
  },
  optionText: {
    color: "gray",
    fontSize: 16,
  },
  selectedOptionText: {
    color: "black",
    fontWeight: "bold",
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: "black", // Farklı arka plan
    paddingTop: 10,
  },
  resultsList: {
    paddingHorizontal: 20,
  },
  resultItem: {
    alignItems: "center",
    marginBottom: 20,
    flex: 1,
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  artistImage: {
    borderRadius: 100,
  },
  resultText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
});