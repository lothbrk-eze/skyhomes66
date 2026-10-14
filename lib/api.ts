export const API_URL = "https://bombadir.pythonanywhere.com";
export const IMAGE_BASE_URL = `${API_URL}/static/images/`;

export type ThreadType = "inquiry" | "application" | "direct";

export type ThreadMessage = {
  id: number;
  message: string;
  sender_role: string;
  sender_id?: number;
  sender_name?: string;
  created_at?: string;
};