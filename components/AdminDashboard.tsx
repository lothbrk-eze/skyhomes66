import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "../lib/api";
import ConversationModal from "./ConversationModal";

type SectionKey = "users" | "houses" | "applications" | "inquiries" | "verifications";

// Android needs LayoutAnimation explicitly enabled for the smooth resize
// animation to run when the keyboard opens/closes.
if (Platform.OS === "android" && (UIManager as any).setLayoutAnimationEnabled) {
  (UIManager as any).setLayoutAnimationEnabled(true);
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

const AdminDashboard = () => {
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<SectionKey>("users");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Send Notification ────────────────────────────────────────────────────
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [notifySearch, setNotifySearch] = useState("");
  const [notifySelectedUser, setNotifySelectedUser] = useState<any>(null); // null = all users
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyKeyboardHeight, setNotifyKeyboardHeight] = useState(0);
  const notifyScrollRef = useRef<ScrollView>(null);

  // Track the keyboard height ourselves so the "Send Notification" sheet can
  // shrink and lift above it — without this, the Message field and Send
  // button were being pushed behind the keyboard with no way to scroll to them.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotifyKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotifyKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = notifySearch.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  const sendNotification = async () => {
    if (!notifyMessage.trim()) {
      Alert.alert("Required", "Please enter a message.");
      return;
    }
    setNotifySending(true);
    try {
      const formData = new FormData();
      formData.append("message", notifyMessage.trim());
      if (notifySelectedUser) {
        formData.append("user_id", String(notifySelectedUser.user_id ?? notifySelectedUser.id));
      }
      const res = await axios.post(`${API_URL}/api/admin/send_notification`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("Success", res.data?.message || "Notification sent!");
      setNotifyModalVisible(false);
      setNotifyMessage("");
      setNotifySelectedUser(null);
      setNotifySearch("");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to send notification.");
    } finally {
      setNotifySending(false);
    }
  };

  const [conversation, setConversation] = useState<{
    threadType: "inquiry" | "application";
    threadId: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  const sectionTitle =
    activeSection === "users"
      ? "All Users"
      : activeSection === "houses"
      ? "All Houses"
      : activeSection === "applications"
      ? "All Applications"
      : activeSection === "verifications"
      ? "Pending Verifications"
      : "All Inquiries";

  const normalizeArray = (data: any, key: string) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    return [];
  };

  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        const user = stored ? JSON.parse(stored) : null;
        setLoggedUser(user);

        if (!user) {
          setError("Please login first");
          setLoading(false);
          return;
        }

        if (user.role !== "admin") {
          setError("Access denied. Admins only.");
          setLoading(false);
          return;
        }

        const [usersRes, housesRes, appsRes, inquiriesRes, verificationsRes] = await Promise.all([
          axios.get(`${API_URL}/api/admin/users`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/admin/properties`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/admin/applications`).catch(() => ({ data: { applications: [] } })),
          axios.get(`${API_URL}/api/admin/inquiries`).catch(() => ({ data: { inquiries: [] } })),
          axios.get(`${API_URL}/api/admin/pending_verifications`).catch(() => ({ data: [] })),
        ]);

        setUsers(normalizeArray(usersRes.data, "users"));
        setHouses(normalizeArray(housesRes.data, "properties"));
        setApplications(normalizeArray(appsRes.data, "applications"));
        setInquiries(normalizeArray(inquiriesRes.data, "inquiries"));
        setVerifications(normalizeArray(verificationsRes.data, "verifications"));
      } catch (e) {
        console.error("Admin dashboard load error:", e);
        setError("Failed to load admin dashboard. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleVerifyLandlord = async (userId: number, status: "approved" | "rejected") => {
    try {
      const formData = new FormData();
      formData.append("user_id", String(userId));
      formData.append("status", status);

      await axios.post(`${API_URL}/api/admin/verify_landlord`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update the UI state
      setVerifications(prev => prev.filter(v => v.user_id !== userId || v.id !== userId));
      alert(`Landlord has been ${status}.`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      alert("Failed to update verification status.");
    }
  };



  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>
        Welcome, {loggedUser?.username || "Admin"}
      </Text>

      <TouchableOpacity
        style={[styles.card, activeSection === "users" && styles.cardActive]}
        activeOpacity={0.9}
        onPress={() => setActiveSection("users")}
      >
        <Text style={styles.cardNumber}>{users.length}</Text>
        <Text style={styles.cardLabel}>Users</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, activeSection === "houses" && styles.cardActive]}
        activeOpacity={0.9}
        onPress={() => setActiveSection("houses")}
      >
        <Text style={styles.cardNumber}>{houses.length}</Text>
        <Text style={styles.cardLabel}>Houses</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, activeSection === "applications" && styles.cardActive]}
        activeOpacity={0.9}
        onPress={() => setActiveSection("applications")}
      >
        <Text style={styles.cardNumber}>{applications.length}</Text>
        <Text style={styles.cardLabel}>Applications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, activeSection === "inquiries" && styles.cardActive]}
        activeOpacity={0.9}
        onPress={() => setActiveSection("inquiries")}
      >
        <Text style={styles.cardNumber}>{inquiries.length}</Text>
        <Text style={styles.cardLabel}>Inquiries</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, activeSection === "verifications" && styles.cardActive]}
        activeOpacity={0.9}
        onPress={() => setActiveSection("verifications")}
      >
        <Text style={styles.cardNumber}>{verifications.length}</Text>
        <Text style={styles.cardLabel}>Verifications</Text>
      </TouchableOpacity>

      {/* ── Send Notification button ─────────────────────────────────── */}
      <TouchableOpacity
        style={styles.notifyBtn}
        activeOpacity={0.88}
        onPress={() => setNotifyModalVisible(true)}
      >
        <Ionicons name="notifications-outline" size={20} color="#fff" />
        <Text style={styles.notifyBtnText}>Send Notification</Text>
      </TouchableOpacity>

      {/* ── Send Notification Modal ──────────────────────────────────── */}
      <Modal
        visible={notifyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              Platform.OS === "ios" &&
                notifyKeyboardHeight > 0 && {
                  marginBottom: notifyKeyboardHeight,
                  height: SCREEN_HEIGHT - notifyKeyboardHeight - 40,
                  maxHeight: SCREEN_HEIGHT - notifyKeyboardHeight - 40,
                },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Notification</Text>
              <TouchableOpacity onPress={() => setNotifyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={notifyScrollRef}
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Recipient selector */}
              <Text style={styles.modalLabel}>Recipient</Text>
              <TouchableOpacity
                style={[
                  styles.allUsersChip,
                  !notifySelectedUser && styles.allUsersChipActive,
                ]}
                onPress={() => { setNotifySelectedUser(null); setNotifySearch(""); }}
              >
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={!notifySelectedUser ? "#fff" : "#374151"}
                />
                <Text style={[
                  styles.allUsersChipText,
                  !notifySelectedUser && styles.allUsersChipTextActive,
                ]}>All Users</Text>
              </TouchableOpacity>

              {/* Search box */}
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or email..."
                  placeholderTextColor="#9CA3AF"
                  value={notifySearch}
                  onChangeText={(t) => { setNotifySearch(t); setNotifySelectedUser(null); }}
                />
              </View>

              {/* User list */}
              {notifySearch.trim().length > 0 && (
                <View style={styles.userDropdown}>
                  {filteredUsers.length === 0 ? (
                    <Text style={styles.noUserText}>No users found</Text>
                  ) : (
                    <FlatList
                      data={filteredUsers.slice(0, 6)}
                      keyExtractor={(u, i) => String(u.user_id ?? u.id ?? i)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.userRow,
                            notifySelectedUser?.user_id === item.user_id && styles.userRowActive,
                          ]}
                          onPress={() => { setNotifySelectedUser(item); setNotifySearch(""); }}
                        >
                          <Ionicons name="person-circle-outline" size={20} color="#6b7280" />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.userRowName}>{item.username || "—"}</Text>
                            <Text style={styles.userRowEmail}>{item.email || ""}</Text>
                          </View>
                          {notifySelectedUser?.user_id === item.user_id && (
                            <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
                          )}
                        </TouchableOpacity>
                      )}
                      scrollEnabled={false}
                    />
                  )}
                </View>
              )}

              {/* Selected recipient pill */}
              {notifySelectedUser && (
                <View style={styles.selectedPill}>
                  <Ionicons name="person-outline" size={14} color="#2563eb" />
                  <Text style={styles.selectedPillText}>
                    {notifySelectedUser.username} · {notifySelectedUser.email}
                  </Text>
                  <TouchableOpacity onPress={() => setNotifySelectedUser(null)}>
                    <Ionicons name="close-circle" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Message input */}
              <Text style={[styles.modalLabel, { marginTop: 14 }]}>Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Type your notification message..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                value={notifyMessage}
                onChangeText={setNotifyMessage}
                onFocus={() =>
                  setTimeout(
                    () => notifyScrollRef.current?.scrollToEnd({ animated: true }),
                    150
                  )
                }
              />

              {/* Send button */}
              <TouchableOpacity
                style={[styles.sendBtn, notifySending && { opacity: 0.6 }]}
                onPress={sendNotification}
                disabled={notifySending}
              >
                {notifySending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.sendBtnText}>
                      {notifySelectedUser
                        ? `Send to ${notifySelectedUser.username}`
                        : "Send to All Users"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>{sectionTitle}</Text>

        {activeSection === "users" &&
          (users.length === 0 ? (
            <Text style={styles.emptyText}>No users found.</Text>
          ) : (
            users.map((user, index) => (
              <View key={user.user_id ?? user.id ?? user.email ?? index} style={styles.row}>
                <Text style={styles.rowTitle}>{user.username || "No username"}</Text>
                <Text style={styles.rowMeta}>Email: {user.email || "N/A"}</Text>
                <Text style={styles.rowMeta}>Role: {user.role || "N/A"}</Text>
              </View>
            ))
          ))}

        {activeSection === "houses" &&
          (houses.length === 0 ? (
            <Text style={styles.emptyText}>No houses found.</Text>
          ) : (
            houses.map((house, index) => {
              const propertyId = house.property_id ?? house.id ?? index;
              const landlordId = house.landlord_id ?? house.user_id ?? house.owner_id;
              return (
                <View key={propertyId} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {house.title || house.name || "Untitled house"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Location: {house.location || house.address || "N/A"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Price: {house.price ?? house.rent ?? "N/A"}
                  </Text>
                  {landlordId ? (
                    <Text style={[styles.rowMeta, { color: "#9ca3af", marginTop: 8 }]}>Landlord info available</Text>
                  ) : (
                    <Text style={[styles.rowMeta, { color: "#9ca3af", marginTop: 8 }]}>Landlord info unavailable</Text>
                  )}
                </View>
              );
            })
          ))}

        {activeSection === "applications" &&
          (applications.length === 0 ? (
            <Text style={styles.emptyText}>No applications found.</Text>
          ) : (
            applications.map((app, index) => (
              <View key={app.application_id ?? app.id ?? index} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {app.applicant_name || app.full_name || app.username || "Applicant"}
                </Text>
                <Text style={styles.rowMeta}>
                  Email: {app.tenant_email || app.email || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Phone: {app.applicant_phone || app.phone || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Property: {app.property_title || app.house_title || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Location: {app.property_location || app.property_address || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Landlord: {app.landlord_username || "N/A"}
                  {app.landlord_email ? ` (${app.landlord_email})` : ""}
                </Text>
                <Text style={styles.rowMeta}>
                  Landlord phone: {app.landlord_phone || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>Status: {app.status || "Pending"}</Text>
                <TouchableOpacity
                  style={styles.replyBtn}
                  onPress={() =>
                    setConversation({
                      threadType: "application",
                      threadId: app.application_id ?? app.id,
                      title: `Application: ${app.property_title || "Property"}`,
                      subtitle: `Tenant: ${app.applicant_name || "N/A"} · Landlord: ${app.landlord_username || "N/A"}`,
                    })
                  }
                >
                  <Text style={styles.replyBtnText}>View conversation</Text>
                </TouchableOpacity>
              </View>
            ))
          ))}

        {activeSection === "inquiries" &&
          (inquiries.length === 0 ? (
            <Text style={styles.emptyText}>No inquiries found.</Text>
          ) : (
            inquiries.map((inquiry, index) => (
              <View key={inquiry.inquiry_id ?? inquiry.id ?? index} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {inquiry.house_type || inquiry.houseType || "House type not set"}
                  {inquiry.unread_from_user > 0 ? " • New reply" : ""}
                </Text>
                <Text style={styles.rowMeta}>
                  User: {inquiry.username || "Guest / not linked"}
                  {inquiry.email ? ` · ${inquiry.email}` : ""}
                </Text>
                <Text style={styles.rowMeta}>
                  Phone: {inquiry.phone || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Location: {inquiry.location || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Road proximity: {inquiry.road_proximity || inquiry.roadProximity || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Budget: {inquiry.budget ?? "N/A"}
                </Text>
                <Text style={styles.rowMeta}>
                  Utilities:{" "}
                  {Array.isArray(inquiry.utilities)
                    ? inquiry.utilities.join(", ")
                    : inquiry.utilities || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>Notes: {inquiry.notes || "N/A"}</Text>
                <TouchableOpacity
                  style={styles.replyBtn}
                  onPress={() =>
                    setConversation({
                      threadType: "inquiry",
                      threadId: inquiry.inquiry_id ?? inquiry.id,
                      title: `Inquiry: ${inquiry.house_type || inquiry.houseType || "House"}`,
                      subtitle: inquiry.username
                        ? `${inquiry.username} · ${inquiry.location || ""}`
                        : inquiry.location || undefined,
                    })
                  }
                >
                  <Text style={styles.replyBtnText}>Reply to user</Text>
                </TouchableOpacity>
              </View>
            ))
          ))}

        {activeSection === "verifications" &&
          (verifications.length === 0 ? (
            <Text style={styles.emptyText}>No pending verifications found.</Text>
          ) : (
            verifications.map((verification, index) => (
              <View key={verification.user_id ?? verification.id ?? index} style={styles.row}>
                <Text style={styles.rowTitle}>
                  Landlord: {verification.username || verification.name || "N/A"}
                </Text>
                <Text style={styles.rowMeta}>Email: {verification.email || "N/A"}</Text>
                {verification.id_photo && (
                  <View style={styles.imageContainer}>
                    <Text style={styles.imageLabel}>ID Photo:</Text>
                    <Image
                      source={{ uri: `${API_URL}/static/images/${verification.id_photo}` }}
                      style={styles.documentImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {verification.proof_of_ownership && (
                  <View style={styles.imageContainer}>
                    <Text style={styles.imageLabel}>Proof of Ownership:</Text>
                    <Image
                      source={{ uri: `${API_URL}/static/images/${verification.proof_of_ownership}` }}
                      style={styles.documentImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleVerifyLandlord(verification.user_id || verification.id, "approved")}
                  >
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleVerifyLandlord(verification.user_id || verification.id, "rejected")}
                  >
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ))}
      </View>


      {conversation && loggedUser?.user_id && (
        <ConversationModal
          visible={!!conversation}
          onClose={() => setConversation(null)}
          threadType={conversation.threadType}
          threadId={conversation.threadId}
          userId={loggedUser.user_id}
          senderRole="admin"
          title={conversation.title}
          subtitle={conversation.subtitle}
          readOnly={conversation.threadType === "application"}
        />
      )}
    </ScrollView>
  );
};

export default AdminDashboard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f7fb",
    padding: 20,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    elevation: 3,
    alignItems: "center",
  },
  cardActive: {
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  cardNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2563eb",
  },
  cardLabel: {
    fontSize: 16,
    color: "#374151",
    marginTop: 6,
  },
  error: {
    color: "#dc2626",
    fontSize: 16,
    textAlign: "center",
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
  row: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#f9fafb",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 13,
    color: "#4b5563",
  },
  viewDocButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#e0e7ff",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  viewDocText: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "600",
  },
  imageContainer: {
    marginTop: 10,
    marginBottom: 5,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  documentImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  approveBtn: {
    backgroundColor: "#10b981",
  },
  rejectBtn: {
    backgroundColor: "#ef4444",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  replyBtn: {
    marginTop: 10,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  replyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  // ── Send Notification ──────────────────────────────────────────────────
  notifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  notifyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  allUsersChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  allUsersChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  allUsersChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  allUsersChipTextActive: {
    color: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  userDropdown: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
    overflow: "hidden",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  userRowActive: {
    backgroundColor: "#eff6ff",
  },
  userRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  userRowEmail: {
    fontSize: 12,
    color: "#6b7280",
  },
  noUserText: {
    padding: 12,
    color: "#6b7280",
    fontSize: 13,
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  selectedPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1d4ed8",
    flexShrink: 1,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
    textAlignVertical: "top",
    minHeight: 100,
    marginBottom: 16,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});