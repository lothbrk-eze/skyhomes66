import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "https://bombadir.pythonanywhere.com";

/** Clears local session keys after logout or account deletion. */
export async function clearLocalSession(rememberedUsername?: string) {
  if (rememberedUsername) {
    await AsyncStorage.setItem("username", rememberedUsername);
  }
  await AsyncStorage.multiRemove([
    "user",
    "user_id",
    "role",
    "email",
    "phone",
    "isLoggedIn",
    "pending_signup",
  ]);
}

/** Permanently deletes the account on the server (requires backend route). */
export async function deleteAccountOnServer(userId: string | number) {
  const formData = new FormData();
  formData.append("user_id", String(userId));
  const response = await axios.post(`${API_URL}/api/delete_account`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
