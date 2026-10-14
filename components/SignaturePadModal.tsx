import React, { useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { WebView } from "react-native-webview";

interface SignaturePadModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveSignature: (signatureBase64: string, signerName: string) => void;
  signerRole: "landlord" | "tenant";
  defaultSignerName?: string;
  unitCode?: string;
}

const C = {
  primary: "#FC5C02",
  primaryLight: "#FFF1EA",
  bg: "#F4F6F9",
  white: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  soft: "#F9FAFB",
  green: "#059669",
  greenLight: "#ECFDF5",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
};

const HTML_CANVAS = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
  body, html { width: 100%; height: 100%; overflow: hidden; background: #fafafa; font-family: -apple-system, Roboto, sans-serif; }
  #canvas-container { width: 100%; height: 100%; position: relative; background: #ffffff; }
  canvas { width: 100%; height: 100%; touch-action: none; display: block; }
  .guide-line { position: absolute; bottom: 35px; left: 20px; right: 20px; border-bottom: 1.5px dashed #cbd5e1; pointer-events: none; }
  .guide-label { position: absolute; bottom: 12px; left: 24px; font-size: 11px; color: #94a3b8; pointer-events: none; font-weight: 500; }
  .sign-x { position: absolute; bottom: 38px; left: 24px; font-size: 16px; font-weight: bold; color: #64748b; pointer-events: none; }
</style>
</head>
<body>
<div id="canvas-container">
  <div class="sign-x">✕</div>
  <div class="guide-line"></div>
  <div class="guide-label">Sign above this line</div>
  <canvas id="sig-canvas"></canvas>
</div>

<script>
  const canvas = document.getElementById("sig-canvas");
  const ctx = canvas.getContext("2d");
  let isDrawing = false;
  let hasStrokes = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }

  window.addEventListener("resize", resizeCanvas);
  setTimeout(resizeCanvas, 50);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDraw(e) {
    isDrawing = true;
    hasStrokes = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function moveDraw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw() {
    isDrawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  window.addEventListener("touchend", endDraw);

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes = false;
  }

  function getSignatureData() {
    if (!hasStrokes) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "empty" }));
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "signature", data: dataUrl }));
  }

  window.clearSignature = clearCanvas;
  window.requestSignatureData = getSignatureData;
</script>
</body>
</html>
`;

export default function SignaturePadModal({
  visible,
  onClose,
  onSaveSignature,
  signerRole,
  defaultSignerName = "",
  unitCode,
}: SignaturePadModalProps) {
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [agreedConsent, setAgreedConsent] = useState(true);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const webViewRef = useRef<WebView>(null);

  const handleClear = () => {
    if (mode === "draw") {
      webViewRef.current?.injectJavaScript("window.clearSignature(); true;");
    } else {
      setSignerName("");
    }
  };

  const handleApplySignature = () => {
    if (!signerName.trim()) {
      Alert.alert("Missing Full Name", "Please enter your full legal name as the signatory.");
      return;
    }

    if (!agreedConsent) {
      Alert.alert(
        "Consent Required",
        "Please check the legal acknowledgement box to confirm your electronic signature."
      );
      return;
    }

    if (mode === "draw") {
      // Trigger data extraction from WebView
      webViewRef.current?.injectJavaScript("window.requestSignatureData(); true;");
    } else {
      // Generate a typed signature placeholder / data URI
      const dateStr = new Date().toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const signaturePayload = `TYPED_SIG:${signerName.trim()}:${dateStr}:${signerRole}`;
      onSaveSignature(signaturePayload, signerName.trim());
      onClose();
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "empty") {
        Alert.alert("Signature Required", "Please draw your signature in the box above before submitting.");
      } else if (msg.type === "signature" && msg.data) {
        onSaveSignature(msg.data, signerName.trim());
        onClose();
      }
    } catch (e) {
      console.error("Signature parse error:", e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {signerRole === "landlord" ? "Landlord E-Signature" : "Tenant E-Signature"}
              </Text>
              <Text style={styles.modalSub}>
                {unitCode ? `Unit ${unitCode} Lease Agreement` : "Digital Execution Pad"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Mode Switcher */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, mode === "draw" && styles.modeTabActive]}
                onPress={() => setMode("draw")}
              >
                <Ionicons
                  name="pencil"
                  size={16}
                  color={mode === "draw" ? C.primary : C.subtext}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "draw" && styles.modeTabTextActive,
                  ]}
                >
                  Draw Signature
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, mode === "type" && styles.modeTabActive]}
                onPress={() => setMode("type")}
              >
                <Ionicons
                  name="text"
                  size={16}
                  color={mode === "type" ? C.primary : C.subtext}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "type" && styles.modeTabTextActive,
                  ]}
                >
                  Type Legal Name
                </Text>
              </TouchableOpacity>
            </View>

            {/* Signer Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Signatory Legal Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder={signerRole === "landlord" ? "e.g. Landlord Name / Agent" : "e.g. Tenant Full Name"}
                placeholderTextColor={C.muted}
                value={signerName}
                onChangeText={setSignerName}
              />
            </View>

            {/* Drawing Area */}
            {mode === "draw" ? (
              <View style={styles.padWrapper}>
                <View style={styles.padHeader}>
                  <Text style={styles.padHeaderTitle}>Sign with your finger or stylus:</Text>
                  <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
                    <Ionicons name="refresh" size={14} color={C.primary} />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.canvasHolder}>
                  <WebView
                    ref={webViewRef}
                    originWhitelist={["*"]}
                    source={{ html: HTML_CANVAS }}
                    style={styles.webView}
                    onMessage={handleWebViewMessage}
                    scrollEnabled={false}
                    javaScriptEnabled
                    domStorageEnabled
                  />
                </View>
              </View>
            ) : (
              <View style={styles.typeWrapper}>
                <Text style={styles.padHeaderTitle}>Preview of Digital Type Signature:</Text>
                <View style={styles.typedPreviewBox}>
                  <Text style={styles.cursiveText}>
                    {signerName.trim() || "Your Legal Name"}
                  </Text>
                  <View style={styles.typedMeta}>
                    <Text style={styles.typedMetaText}>
                      ✓ Digitally Certified · {signerRole.toUpperCase()} ·{" "}
                      {new Date().toLocaleDateString("en-KE")}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Legal Consent Checkbox */}
            <TouchableOpacity
              style={styles.consentRow}
              activeOpacity={0.8}
              onPress={() => setAgreedConsent(!agreedConsent)}
            >
              <Ionicons
                name={agreedConsent ? "checkbox" : "square-outline"}
                size={22}
                color={agreedConsent ? C.primary : C.muted}
              />
              <Text style={styles.consentText}>
                I acknowledge and agree that this electronic signature is legally binding and constitutes my valid execution of the Tenancy Agreement under applicable Kenyan law.
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleApplySignature}
              activeOpacity={0.88}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Affix & Sign</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  modalSub: {
    fontSize: 13,
    color: C.subtext,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.subtext,
  },
  modeTabTextActive: {
    color: C.primary,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
  },
  padWrapper: {
    marginBottom: 14,
  },
  padHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  padHeaderTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.subtext,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: C.primaryLight,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.primary,
  },
  canvasHolder: {
    height: 180,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  typeWrapper: {
    marginBottom: 14,
  },
  typedPreviewBox: {
    height: 140,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.soft,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  cursiveText: {
    fontSize: 28,
    fontStyle: "italic",
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
  },
  typedMeta: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    width: "100%",
    alignItems: "center",
  },
  typedMetaText: {
    fontSize: 11,
    color: C.subtext,
    fontWeight: "500",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginVertical: 14,
    padding: 12,
    backgroundColor: C.soft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: C.subtext,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.subtext,
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
