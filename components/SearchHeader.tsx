import { View, TextInput, StyleSheet } from "react-native";
import { useSearch } from "../contexts/SearchContext";
import Ionicons from "@expo/vector-icons/Ionicons";

const COLORS = {
  accent: "#2563EB",
  white: "#FFFFFF",
  text: "#181A20",
};

export const SearchHeader = () => {
  const { searchQuery, setSearchQuery } = useSearch();

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={22} color={COLORS.accent} />
        <TextInput
          style={styles.input}
          placeholder="Search houses in any location"
          placeholderTextColor="#A1A7B3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 7,
    paddingHorizontal: 16,
    paddingVertical: 3,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: "row",
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 50,
    width: "160%",
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.text,
  },
});