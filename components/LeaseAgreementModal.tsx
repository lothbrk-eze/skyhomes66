import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import SignaturePadModal from "./SignaturePadModal";
import {
  LeaseAgreementData,
  MASTER_LEASE_TEMPLATES,
  MasterLeaseTemplate,
  TemplateKey,
  renderClauseText,
} from "../lib/leaseTemplates";
import {
  saveLeaseAgreement,
  submitLeaseSignature,
  deleteLeaseAgreement,
} from "../lib/leaseStorage";

interface LeaseAgreementModalProps {
  visible: boolean;
  onClose: () => void;
  unit: {
    unit_id: number;
    unit_code: string;
    unit_type?: string;
    monthly_rent: number;
    deposit_amount?: number;
    tenant_name?: string;
    tenant_phone?: string;
    tenant_email?: string;
    lease_start?: string;
    lease_end?: string;
    rent_due_day?: string | number;
  };
  building: {
    building_id: number | string;
    building_name: string;
    address?: string;
    location?: string;
  };
  landlord: {
    user_id: number | string;
    name?: string;
    phone?: string;
    email?: string;
  };
  initialLease?: LeaseAgreementData | null;
  onLeaseUpdated?: (lease: LeaseAgreementData) => void;
  viewerRole?: "landlord" | "tenant";
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
  greenBorder: "#A7F3D0",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  amberBorder: "#FDE68A",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueBorder: "#BFDBFE",
  red: "#DC2626",
  redLight: "#FEF2F2",
};

export default function LeaseAgreementModal({
  visible,
  onClose,
  unit,
  building,
  landlord,
  initialLease,
  onLeaseUpdated,
  viewerRole = "landlord",
}: LeaseAgreementModalProps) {
  const [activeTab, setActiveTab] = useState<"view" | "create">(
    initialLease ? "view" : "create"
  );
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<TemplateKey>("standard_residential");
  const [currentLease, setCurrentLease] = useState<LeaseAgreementData | null>(
    initialLease || null
  );

  const [leaseTitle, setLeaseTitle] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordPhone, setLandlordPhone] = useState("");
  const [landlordEmail, setLandlordEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantIdNumber, setTenantIdNumber] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [rentDueDay, setRentDueDay] = useState("5");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [noticeDays, setNoticeDays] = useState("30");
  const [customTerms, setCustomTerms] = useState("");

  const [savingLease, setSavingLease] = useState(false);
  const [activeSigRole, setActiveSigRole] = useState<"landlord" | "tenant" | null>(
    null
  );

  useEffect(() => {
    if (initialLease) {
      setCurrentLease(initialLease);
      setActiveTab("view");
    } else {
      setActiveTab("create");
      const chosenTpl =
        MASTER_LEASE_TEMPLATES.find((t) => t.key === selectedTemplateKey) ||
        MASTER_LEASE_TEMPLATES[0];

      setLeaseTitle(`${chosenTpl.name} - Unit ${unit.unit_code}`);
      setLandlordName(landlord.name || "Landlord");
      setLandlordPhone(landlord.phone || "");
      setLandlordEmail(landlord.email || "");
      setTenantName(unit.tenant_name || "");
      setTenantPhone(unit.tenant_phone || "");
      setTenantEmail(unit.tenant_email || "");
      setMonthlyRent(String(unit.monthly_rent || ""));
      setDepositAmount(String(unit.deposit_amount || unit.monthly_rent || ""));
      setRentDueDay(String(unit.rent_due_day || "5"));
      setLeaseStart(
        unit.lease_start || new Date().toISOString().split("T")[0]
      );
      setLeaseEnd(unit.lease_end || "");
      setNoticeDays(String(chosenTpl.defaultNoticeDays));
    }
  }, [initialLease, unit, building, landlord, selectedTemplateKey]);

  const activeTemplate = useMemo(() => {
    return (
      MASTER_LEASE_TEMPLATES.find((t) => t.key === selectedTemplateKey) ||
      MASTER_LEASE_TEMPLATES[0]
    );
  }, [selectedTemplateKey]);

  const handleSelectTemplate = (tpl: MasterLeaseTemplate) => {
    setSelectedTemplateKey(tpl.key);
    setLeaseTitle(`${tpl.name} - Unit ${unit.unit_code}`);
    setNoticeDays(String(tpl.defaultNoticeDays));
  };

  const handleCreateLease = async () => {
    if (!tenantName.trim() || !tenantPhone.trim() || !monthlyRent.trim()) {
      Alert.alert(
        "Missing details",
        "Please provide tenant name, phone number, and monthly rent."
      );
      return;
    }

    setSavingLease(true);
    try {
      const newLeaseData: LeaseAgreementData = {
        unit_id: unit.unit_id,
        building_id: building.building_id,
        landlord_id: landlord.user_id,
        template_type: selectedTemplateKey,
        title: leaseTitle.trim() || `Lease Agreement - Unit ${unit.unit_code}`,
        landlord_name: landlordName.trim() || "Landlord",
        landlord_phone: landlordPhone.trim(),
        landlord_email: landlordEmail.trim(),
        tenant_name: tenantName.trim(),
        tenant_phone: tenantPhone.trim(),
        tenant_email: tenantEmail.trim(),
        tenant_id_number: tenantIdNumber.trim(),
        building_name: building.building_name,
        building_address: building.address,
        building_location: building.location,
        unit_code: unit.unit_code,
        unit_type: unit.unit_type,
        monthly_rent: parseFloat(monthlyRent.replace(/,/g, "")) || 0,
        deposit_amount: parseFloat(depositAmount.replace(/,/g, "")) || 0,
        rent_due_day: parseInt(rentDueDay, 10) || 5,
        lease_start_date: leaseStart.trim() || new Date().toISOString().split("T")[0],
        lease_end_date: leaseEnd.trim() || undefined,
        notice_period_days: parseInt(noticeDays, 10) || 30,
        clauses: activeTemplate.clauses,
        custom_terms: customTerms.trim() || undefined,
        status: "pending_signatures",
        created_at: new Date().toISOString(),
      };

      const res = await saveLeaseAgreement(newLeaseData);
      if (res.ok) {
        setCurrentLease(res.lease);
        setActiveTab("view");
        if (onLeaseUpdated) onLeaseUpdated(res.lease);
        Alert.alert(
          "Lease Agreement Generated",
          `Agreement for Unit ${unit.unit_code} created successfully. You can now affix e-signatures.`
        );
      } else {
        Alert.alert("Error", res.message || "Failed to create lease.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save lease.");
    } finally {
      setSavingLease(false);
    }
  };

  const handleSaveSignature = async (sigBase64: string, signerName: string) => {
    if (!currentLease || !activeSigRole) return;

    try {
      const res = await submitLeaseSignature(
        currentLease.lease_id || 0,
        unit.unit_id,
        activeSigRole,
        sigBase64,
        signerName,
        currentLease
      );

      if (res.ok && res.updatedLease) {
        setCurrentLease(res.updatedLease);
        if (onLeaseUpdated) onLeaseUpdated(res.updatedLease);
        Alert.alert(
          "Signature Recorded",
          `Electronic signature for ${signerName} (${activeSigRole.toUpperCase()}) successfully attached.`
        );
      } else {
        Alert.alert("Error", res.message || "Could not record signature.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save signature.");
    } finally {
      setActiveSigRole(null);
    }
  };

  const handleShareWhatsApp = () => {
    if (!currentLease) return;
    const cleanPhone = (currentLease.tenant_phone || "").replace(/\D/g, "");
    const waPhone = cleanPhone.startsWith("0") ? `254${cleanPhone.slice(1)}` : cleanPhone;

    const msg =
      `*HOODHOMES TENANCY AGREEMENT*\n\n` +
      `🏢 *Property:* ${currentLease.building_name} (Unit ${currentLease.unit_code})\n` +
      `👤 *Landlord:* ${currentLease.landlord_name} (${currentLease.landlord_phone})\n` +
      `👤 *Tenant:* ${currentLease.tenant_name}\n` +
      `💰 *Monthly Rent:* KES ${Number(currentLease.monthly_rent).toLocaleString()} (Due Day ${currentLease.rent_due_day})\n` +
      `🔒 *Deposit:* KES ${Number(currentLease.deposit_amount).toLocaleString()}\n` +
      `📅 *Lease Start:* ${currentLease.lease_start_date}\n` +
      `📝 *Status:* ${currentLease.status.toUpperCase()}\n\n` +
      `Please review and confirm your digital agreement on HoodHomes.`;

    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("WhatsApp", "Could not open WhatsApp. Sharing text instead.");
      Share.share({ message: msg });
    });
  };

  const handleGeneralShare = () => {
    if (!currentLease) return;
    const msg = `HoodHomes Lease Agreement for Unit ${currentLease.unit_code} at ${currentLease.building_name}.\nTenant: ${currentLease.tenant_name}\nRent: KES ${Number(currentLease.monthly_rent).toLocaleString()}\nStatus: ${currentLease.status.toUpperCase()}`;
    Share.share({ message: msg, title: currentLease.title });
  };

  const handleDeleteLease = () => {
    if (!currentLease?.lease_id) return;
    Alert.alert(
      "Delete Lease Agreement",
      `Are you sure you want to discard this lease agreement for Unit ${unit.unit_code}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteLeaseAgreement(unit.unit_id, currentLease.lease_id!);
            setCurrentLease(null);
            setActiveTab("create");
            Alert.alert("Deleted", "Lease agreement has been removed.");
          },
        },
      ]
    );
  };

  const renderSignatureView = (sig?: string | null, name?: string, role?: string, date?: string | null) => {
    if (!sig) return null;

    const isTyped = sig.startsWith("TYPED_SIG:");
    if (isTyped) {
      const parts = sig.split(":");
      const typedName = parts[1] || name || "Signatory";
      const typedDate = parts[2] || (date ? new Date(date).toLocaleDateString() : "");
      return (
        <View style={styles.sigDisplayBox}>
          <Text style={styles.sigTypedCursive}>{typedName}</Text>
          <Text style={styles.sigVerifiedBadge}>
            ✓ Digitally Verified · {role?.toUpperCase()} · {typedDate}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.sigDisplayBox}>
        <Image
          source={{ uri: sig }}
          style={styles.sigImage}
          resizeMode="contain"
        />
        <Text style={styles.sigVerifiedBadge}>
          ✓ E-Signature Verified · {name || role?.toUpperCase()} · {date ? new Date(date).toLocaleDateString() : ""}
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {currentLease && activeTab === "view"
                  ? "Tenancy Agreement"
                  : "New Lease Agreement"}
              </Text>
              <Text style={styles.headerSub}>
                {building.building_name} · Unit {unit.unit_code}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher if lease exists */}
          {currentLease && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "view" && styles.tabBtnActive]}
                onPress={() => setActiveTab("view")}
              >
                <Ionicons
                  name="document-text"
                  size={15}
                  color={activeTab === "view" ? C.primary : C.subtext}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "view" && styles.tabBtnTextActive,
                  ]}
                >
                  View & Sign Agreement
                </Text>
              </TouchableOpacity>

              {viewerRole === "landlord" && (
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "create" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("create")}
                >
                  <Ionicons
                    name="create"
                    size={15}
                    color={activeTab === "create" ? C.primary : C.subtext}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "create" && styles.tabBtnTextActive,
                    ]}
                  >
                    Draft / New Template
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {activeTab === "view" && currentLease && (
              <View style={styles.documentSheet}>
                {/* Official Header Badge */}
                <View style={styles.docHeaderBadge}>
                  <View style={styles.docHeaderLogo}>
                    <Ionicons name="shield-checkmark" size={20} color={C.primary} />
                    <Text style={styles.docBrandText}>HOODHOMES LEGAL LEASE</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      currentLease.status === "active"
                        ? styles.statusPillActive
                        : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        currentLease.status === "active"
                          ? styles.statusTextActive
                          : styles.statusTextPending,
                      ]}
                    >
                      {currentLease.status === "active"
                        ? "🟢 Active & Executed"
                        : "🟡 Pending Signatures"}
                    </Text>
                  </View>
                </View>

                {/* Agreement Title */}
                <Text style={styles.docMainTitle}>{currentLease.title}</Text>
                <Text style={styles.docExecutionDate}>
                  Execution Date:{" "}
                  {new Date(currentLease.created_at).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>

                {/* Quick Summary Grid */}
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Landlord</Text>
                      <Text style={styles.summaryVal}>{currentLease.landlord_name}</Text>
                      <Text style={styles.summarySub}>{currentLease.landlord_phone}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Tenant</Text>
                      <Text style={styles.summaryVal}>{currentLease.tenant_name}</Text>
                      <Text style={styles.summarySub}>{currentLease.tenant_phone}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Premises</Text>
                      <Text style={styles.summaryVal}>
                        Unit {currentLease.unit_code}
                      </Text>
                      <Text style={styles.summarySub}>
                        {currentLease.building_name}
                      </Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Monthly Rent</Text>
                      <Text style={[styles.summaryVal, { color: C.green }]}>
                        KES {Number(currentLease.monthly_rent).toLocaleString()}
                      </Text>
                      <Text style={styles.summarySub}>
                        Due day {currentLease.rent_due_day} of month
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Deposit Held</Text>
                      <Text style={styles.summaryVal}>
                        KES {Number(currentLease.deposit_amount).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Term Commencing</Text>
                      <Text style={styles.summaryVal}>
                        {currentLease.lease_start_date}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Clauses & Legal Text */}
                <Text style={styles.sectionTitle}>TERMS & CONDITIONS</Text>
                <View style={styles.clausesList}>
                  {currentLease.clauses && currentLease.clauses.length > 0 ? (
                    currentLease.clauses.map((clause, idx) => (
                      <View key={clause.id || idx} style={styles.clauseItem}>
                        <Text style={styles.clauseTitle}>{clause.title}</Text>
                        <Text style={styles.clauseBody}>
                          {renderClauseText(clause.content, currentLease)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.clauseBody}>
                      Standard tenancy covenants and conditions apply to this unit.
                    </Text>
                  )}

                  {!!currentLease.custom_terms && (
                    <View style={styles.clauseItem}>
                      <Text style={styles.clauseTitle}>Special Additional Terms</Text>
                      <Text style={styles.clauseBody}>{currentLease.custom_terms}</Text>
                    </View>
                  )}
                </View>

                {/* SIGNATURES SECTION */}
                <Text style={styles.sectionTitle}>DIGITAL SIGNATURES & EXECUTION</Text>

                {/* Landlord Signature Block */}
                <View style={styles.signatureCard}>
                  <View style={styles.sigCardHeader}>
                    <Ionicons name="business" size={18} color={C.primary} />
                    <Text style={styles.sigCardTitle}>Landlord / Property Manager</Text>
                  </View>

                  {currentLease.landlord_signature ? (
                    renderSignatureView(
                      currentLease.landlord_signature,
                      currentLease.landlord_signer_name || currentLease.landlord_name,
                      "Landlord",
                      currentLease.landlord_signed_at
                    )
                  ) : (
                    <View style={styles.sigPendingBox}>
                      <Text style={styles.sigPendingText}>
                        Landlord signature pending execution.
                      </Text>
                      {viewerRole === "landlord" && (
                        <TouchableOpacity
                          style={styles.signActionBtn}
                          onPress={() => setActiveSigRole("landlord")}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="pencil" size={16} color="#fff" />
                          <Text style={styles.signActionBtnText}>Sign as Landlord</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* Tenant Signature Block */}
                <View style={styles.signatureCard}>
                  <View style={styles.sigCardHeader}>
                    <Ionicons name="person" size={18} color={C.blue} />
                    <Text style={styles.sigCardTitle}>Tenant Signatory</Text>
                  </View>

                  {currentLease.tenant_signature ? (
                    renderSignatureView(
                      currentLease.tenant_signature,
                      currentLease.tenant_signer_name || currentLease.tenant_name,
                      "Tenant",
                      currentLease.tenant_signed_at
                    )
                  ) : (
                    <View style={styles.sigPendingBox}>
                      <Text style={styles.sigPendingText}>
                        Tenant signature pending execution.
                      </Text>
                      <TouchableOpacity
                        style={[styles.signActionBtn, { backgroundColor: C.blue }]}
                        onPress={() => setActiveSigRole("tenant")}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="pencil" size={16} color="#fff" />
                        <Text style={styles.signActionBtnText}>
                          Sign as Tenant ({currentLease.tenant_name || "Tenant"})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Sharing & Management Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={handleShareWhatsApp}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.waBtnText}>WhatsApp Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={handleGeneralShare}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="share-social-outline" size={18} color={C.text} />
                    <Text style={styles.shareBtnText}>Share</Text>
                  </TouchableOpacity>
                </View>

                {viewerRole === "landlord" && (
                  <TouchableOpacity
                    style={styles.deleteLeaseBtn}
                    onPress={handleDeleteLease}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.red} />
                    <Text style={styles.deleteLeaseText}>Discard / Delete Lease</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeTab === "create" && (
              <View style={styles.createFormWrap}>
                {/* Template Selector */}
                <Text style={styles.formSectionTitle}>1. Select Standard Template</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tplScrollRow}
                >
                  {MASTER_LEASE_TEMPLATES.map((tpl) => {
                    const isSelected = tpl.key === selectedTemplateKey;
                    return (
                      <TouchableOpacity
                        key={tpl.key}
                        style={[
                          styles.tplCard,
                          isSelected && styles.tplCardSelected,
                        ]}
                        onPress={() => handleSelectTemplate(tpl)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.tplIconWrap,
                            isSelected && styles.tplIconWrapSelected,
                          ]}
                        >
                          <Ionicons
                            name={tpl.icon as any}
                            size={20}
                            color={isSelected ? "#fff" : C.primary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.tplCardName,
                            isSelected && styles.tplCardNameSelected,
                          ]}
                        >
                          {tpl.name}
                        </Text>
                        <Text style={styles.tplCardDesc} numberOfLines={2}>
                          {tpl.shortDescription}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Form Details */}
                <Text style={styles.formSectionTitle}>2. Agreement & Tenant Details</Text>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Agreement Title</Text>
                  <TextInput
                    style={styles.formInput}
                    value={leaseTitle}
                    onChangeText={setLeaseTitle}
                    placeholder="e.g. Standard Residential Tenancy"
                  />

                  <View style={styles.formRow2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Tenant Name *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={tenantName}
                        onChangeText={setTenantName}
                        placeholder="John Kamau"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Tenant Phone *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={tenantPhone}
                        onChangeText={setTenantPhone}
                        placeholder="0712345678"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.formRow2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Tenant Email (Optional)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={tenantEmail}
                        onChangeText={setTenantEmail}
                        placeholder="tenant@mail.com"
                        keyboardType="email-address"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Tenant National ID</Text>
                      <TextInput
                        style={styles.formInput}
                        value={tenantIdNumber}
                        onChangeText={setTenantIdNumber}
                        placeholder="e.g. 28910482"
                      />
                    </View>
                  </View>
                </View>

                {/* Financial & Terms */}
                <Text style={styles.formSectionTitle}>3. Financials & Term</Text>
                <View style={styles.formCard}>
                  <View style={styles.formRow2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Monthly Rent (KES) *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={monthlyRent}
                        onChangeText={setMonthlyRent}
                        placeholder="15000"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Deposit Amount (KES)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={depositAmount}
                        onChangeText={setDepositAmount}
                        placeholder="15000"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.formRow2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Rent Due Day</Text>
                      <TextInput
                        style={styles.formInput}
                        value={rentDueDay}
                        onChangeText={setRentDueDay}
                        placeholder="5"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Notice Period (Days)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={noticeDays}
                        onChangeText={setNoticeDays}
                        placeholder="30"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.formRow2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Lease Start Date</Text>
                      <TextInput
                        style={styles.formInput}
                        value={leaseStart}
                        onChangeText={setLeaseStart}
                        placeholder="YYYY-MM-DD"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Lease End Date (Optional)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={leaseEnd}
                        onChangeText={setLeaseEnd}
                        placeholder="YYYY-MM-DD"
                      />
                    </View>
                  </View>
                </View>

                {/* Additional Clauses */}
                <Text style={styles.formSectionTitle}>4. Special Terms & House Rules</Text>
                <View style={styles.formCard}>
                  <TextInput
                    style={[styles.formInput, { height: 80, textAlignVertical: "top" }]}
                    value={customTerms}
                    onChangeText={setCustomTerms}
                    placeholder="e.g. No pets allowed on premises. Water meter reading is 450 units on handover."
                    multiline
                  />
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={handleCreateLease}
                  disabled={savingLease}
                  activeOpacity={0.88}
                >
                  {savingLease ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="document-attach" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>
                        Generate Agreement & Sign
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {activeSigRole && (
            <SignaturePadModal
              visible={!!activeSigRole}
              onClose={() => setActiveSigRole(null)}
              signerRole={activeSigRole}
              defaultSignerName={
                activeSigRole === "landlord"
                  ? currentLease?.landlord_name || landlord.name
                  : currentLease?.tenant_name || unit.tenant_name
              }
              unitCode={unit.unit_code}
              onSaveSignature={handleSaveSignature}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "92%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  headerSub: {
    fontSize: 13,
    color: C.subtext,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.soft,
  },
  tabBtnActive: {
    backgroundColor: C.primaryLight,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.subtext,
  },
  tabBtnTextActive: {
    color: C.primary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  documentSheet: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docHeaderBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  docHeaderLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docBrandText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillActive: {
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  statusPillPending: {
    backgroundColor: C.amberLight,
    borderWidth: 1,
    borderColor: C.amberBorder,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusTextActive: {
    color: C.green,
  },
  statusTextPending: {
    color: C.amber,
  },
  docMainTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    marginBottom: 4,
  },
  docExecutionDate: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: C.soft,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  summarySub: {
    fontSize: 12,
    color: C.subtext,
    marginTop: 1,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 0.5,
    marginVertical: 12,
  },
  clausesList: {
    gap: 12,
    marginBottom: 20,
  },
  clauseItem: {
    backgroundColor: C.soft,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  clauseTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    marginBottom: 4,
  },
  clauseBody: {
    fontSize: 13,
    lineHeight: 19,
    color: C.subtext,
  },
  signatureCard: {
    backgroundColor: C.soft,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  sigCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sigCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  sigDisplayBox: {
    alignItems: "center",
    padding: 10,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  sigImage: {
    width: "100%",
    height: 70,
  },
  sigTypedCursive: {
    fontSize: 24,
    fontStyle: "italic",
    fontWeight: "700",
    color: C.text,
    paddingVertical: 10,
  },
  sigVerifiedBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: C.green,
    marginTop: 6,
  },
  sigPendingBox: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sigPendingText: {
    fontSize: 13,
    color: C.subtext,
    marginBottom: 10,
  },
  signActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.primary,
  },
  signActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  waBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#25D366",
    paddingVertical: 12,
    borderRadius: 10,
  },
  waBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  deleteLeaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  deleteLeaseText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.red,
  },
  createFormWrap: {
    gap: 12,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    marginTop: 6,
    marginBottom: 4,
  },
  tplScrollRow: {
    gap: 10,
    paddingBottom: 6,
  },
  tplCard: {
    width: 170,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  tplCardSelected: {
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  tplIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tplIconWrapSelected: {
    backgroundColor: C.primary,
  },
  tplCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    marginBottom: 4,
  },
  tplCardNameSelected: {
    color: C.primary,
  },
  tplCardDesc: {
    fontSize: 11,
    color: C.subtext,
    lineHeight: 15,
  },
  formCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.text,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
  },
  formRow2: {
    flexDirection: "row",
    gap: 10,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});