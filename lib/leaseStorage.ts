import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "./api";
import { LeaseAgreementData, TemplateKey, MASTER_LEASE_TEMPLATES } from "./leaseTemplates";
export type { LeaseAgreementData, TemplateKey };
export { MASTER_LEASE_TEMPLATES };

export interface UnitDocument {
  document_id: string;
  unit_id: number;
  building_id: number | string;
  lease_id?: string | number | null;
  document_title: string;
  document_type: "lease_agreement" | "tenant_id" | "inventory_checklist" | "utility_receipt" | "other";
  file_url: string;
  file_size_kb?: number;
  uploaded_by_id: number | string;
  uploaded_by_role: "landlord" | "tenant" | "admin";
  created_at: string;
}

const LEASES_STORAGE_PREFIX = "@unit_leases_";
const DOCUMENTS_STORAGE_PREFIX = "@unit_docs_";

// Helper to generate unique ID
export const generateDocId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

export function normalizeLeaseData(raw: any): LeaseAgreementData {
  let clauses: any[] = [];
  if (Array.isArray(raw.clauses)) {
    clauses = raw.clauses;
  } else if (typeof raw.clauses === "string") {
    try {
      const parsed = JSON.parse(raw.clauses);
      if (Array.isArray(parsed)) clauses = parsed;
    } catch {}
  }

  return {
    ...raw,
    lease_id: raw.lease_id ?? raw.id,
    unit_id: Number(raw.unit_id) || 0,
    building_id: raw.building_id || "general",
    landlord_id: raw.landlord_id || 0,
    tenant_id: raw.tenant_id ?? raw.tenant_user_id,
    building_name: raw.building_name || "",
    building_address: raw.building_address || "",
    building_location: raw.building_location || "",
    unit_code: raw.unit_code || "",
    unit_type: raw.unit_type || "",
    monthly_rent: Number(raw.monthly_rent) || 0,
    deposit_amount: Number(raw.deposit_amount) || 0,
    rent_due_day: raw.rent_due_day || 5,
    notice_period_days: Number(raw.notice_period_days) || 30,
    clauses: clauses,
    landlord_signature: raw.landlord_signature || null,
    landlord_signed_at: raw.landlord_signed_at || null,
    landlord_signer_name: raw.landlord_signer_name || "",
    tenant_signature: raw.tenant_signature || null,
    tenant_signed_at: raw.tenant_signed_at || null,
    tenant_signer_name: raw.tenant_signer_name || "",
    status: raw.status || "pending_signatures",
  };
}

// ─── LEASE AGREEMENTS ──────────────────────────────────────────────────────────

/**
 * Load all lease agreements for a given unit (Active, Pending, Historical)
 */
export async function loadUnitLeases(
  unitId: number,
  buildingId?: number | string
): Promise<LeaseAgreementData[]> {
  try {
    const localKey = `${LEASES_STORAGE_PREFIX}${unitId}`;
    const localRaw = await AsyncStorage.getItem(localKey);
    let localLeases: LeaseAgreementData[] = localRaw ? JSON.parse(localRaw) : [];

    // Try fetching from backend API
    try {
      const res = await axios.get(`${API_URL}/api/landlord/units/${unitId}/leases`, {
        timeout: 5000,
      });
      if (res.data && Array.isArray(res.data.leases)) {
        localLeases = res.data.leases.map(normalizeLeaseData);
        await AsyncStorage.setItem(localKey, JSON.stringify(localLeases));
      }
    } catch (apiErr) {
      console.log("Using local lease cache for unit", unitId);
    }

    return localLeases;
  } catch (e) {
    console.error("Error loading unit leases:", e);
    return [];
  }
}

/**
 * Save / Create a new Lease Agreement for a unit
 */
export async function saveLeaseAgreement(
  lease: LeaseAgreementData
): Promise<{ ok: boolean; lease: LeaseAgreementData; message?: string }> {
  try {
    const unitId = lease.unit_id;
    const localKey = `${LEASES_STORAGE_PREFIX}${unitId}`;

    const leaseWithId: LeaseAgreementData = {
      ...lease,
      lease_id: lease.lease_id || generateDocId("lease"),
      created_at: lease.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Save to local storage
    const currentLeases = await loadUnitLeases(unitId, lease.building_id);
    const existingIdx = currentLeases.findIndex(
      (l) => String(l.lease_id) === String(leaseWithId.lease_id)
    );
    let updatedLeases: LeaseAgreementData[];
    if (existingIdx >= 0) {
      updatedLeases = [...currentLeases];
      updatedLeases[existingIdx] = leaseWithId;
    } else {
      updatedLeases = [leaseWithId, ...currentLeases];
    }
    await AsyncStorage.setItem(localKey, JSON.stringify(updatedLeases));

    // 2. Sync to Backend API
    try {
      const fd = new FormData();
      fd.append("lease_id", String(leaseWithId.lease_id));
      fd.append("unit_id", String(leaseWithId.unit_id));
      fd.append("building_id", String(leaseWithId.building_id));
      fd.append("landlord_id", String(leaseWithId.landlord_id));
      if (leaseWithId.tenant_id) fd.append("tenant_id", String(leaseWithId.tenant_id));
      fd.append("template_type", leaseWithId.template_type);
      fd.append("title", leaseWithId.title);
      fd.append("landlord_name", leaseWithId.landlord_name);
      fd.append("landlord_phone", leaseWithId.landlord_phone);
      if (leaseWithId.landlord_email) fd.append("landlord_email", leaseWithId.landlord_email);
      fd.append("tenant_name", leaseWithId.tenant_name);
      fd.append("tenant_phone", leaseWithId.tenant_phone);
      if (leaseWithId.tenant_email) fd.append("tenant_email", leaseWithId.tenant_email);
      if (leaseWithId.tenant_id_number) fd.append("tenant_id_number", leaseWithId.tenant_id_number);
      if (leaseWithId.building_name) fd.append("building_name", leaseWithId.building_name);
      if (leaseWithId.building_address) fd.append("building_address", leaseWithId.building_address);
      if (leaseWithId.building_location) fd.append("building_location", leaseWithId.building_location);
      if (leaseWithId.unit_code) fd.append("unit_code", leaseWithId.unit_code);
      if (leaseWithId.unit_type) fd.append("unit_type", leaseWithId.unit_type);
      fd.append("monthly_rent", String(leaseWithId.monthly_rent));
      fd.append("deposit_amount", String(leaseWithId.deposit_amount));
      fd.append("rent_due_day", String(leaseWithId.rent_due_day));
      fd.append("lease_start_date", leaseWithId.lease_start_date);
      if (leaseWithId.lease_end_date) fd.append("lease_end_date", leaseWithId.lease_end_date);
      fd.append("notice_period_days", String(leaseWithId.notice_period_days));
      fd.append("clauses", JSON.stringify(leaseWithId.clauses));
      if (leaseWithId.custom_terms) fd.append("custom_terms", leaseWithId.custom_terms);
      fd.append("status", leaseWithId.status);
      if (leaseWithId.landlord_signature) fd.append("landlord_signature", leaseWithId.landlord_signature);
      if (leaseWithId.landlord_signed_at) fd.append("landlord_signed_at", leaseWithId.landlord_signed_at);
      if (leaseWithId.landlord_signer_name) fd.append("landlord_signer_name", leaseWithId.landlord_signer_name);
      if (leaseWithId.tenant_signature) fd.append("tenant_signature", leaseWithId.tenant_signature);
      if (leaseWithId.tenant_signed_at) fd.append("tenant_signed_at", leaseWithId.tenant_signed_at);
      if (leaseWithId.tenant_signer_name) fd.append("tenant_signer_name", leaseWithId.tenant_signer_name);

      const res = await axios.post(`${API_URL}/api/landlord/lease/create`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 8000,
      });

      if (res.data && res.data.lease) {
        const savedFromDb = normalizeLeaseData(res.data.lease);
        return { ok: true, lease: savedFromDb };
      }
    } catch (apiErr) {
      console.log("Backend sync notice for lease create (saved locally):", apiErr);
    }

    return { ok: true, lease: leaseWithId };
  } catch (err: any) {
    console.error("Error saving lease agreement:", err);
    return { ok: false, lease, message: err?.message || "Failed to save lease" };
  }
}

/**
 * Capture & Save Landlord or Tenant E-Signature on a Lease Agreement
 */
export async function submitLeaseSignature(
  leaseId: string | number,
  unitId: number,
  signerRole: "landlord" | "tenant",
  signatureDataUri: string,
  signerName: string,
  existingLease?: LeaseAgreementData | null
): Promise<{ ok: boolean; updatedLease?: LeaseAgreementData; message?: string }> {
  try {
    const localKey = `${LEASES_STORAGE_PREFIX}${unitId}`;
    const leases = await loadUnitLeases(unitId);
    const targetIdx = leases.findIndex((l) => String(l.lease_id) === String(leaseId));

    let target: LeaseAgreementData;
    const now = new Date().toISOString();

    if (targetIdx >= 0) {
      target = { ...leases[targetIdx] };
    } else if (existingLease) {
      target = { ...existingLease };
    } else {
      target = {
        lease_id: leaseId,
        unit_id: unitId,
        building_id: "general",
        landlord_id: 0,
        template_type: "standard_residential",
        title: `Lease Agreement - Unit ${unitId}`,
        landlord_name: "Landlord",
        landlord_phone: "",
        tenant_name: signerName,
        tenant_phone: "",
        building_name: "Property",
        unit_code: String(unitId),
        monthly_rent: 0,
        deposit_amount: 0,
        rent_due_day: 5,
        lease_start_date: now.split("T")[0],
        notice_period_days: 30,
        clauses: [],
        status: "pending_signatures",
        created_at: now,
      };
    }

    if (signerRole === "landlord") {
      target.landlord_signature = signatureDataUri;
      target.landlord_signed_at = now;
      target.landlord_signer_name = signerName;
    } else {
      target.tenant_signature = signatureDataUri;
      target.tenant_signed_at = now;
      target.tenant_signer_name = signerName;
    }

    // If both have signed, mark status as active
    if (target.landlord_signature && target.tenant_signature) {
      target.status = "active";
    } else {
      target.status = "pending_signatures";
    }

    target.updated_at = now;

    if (targetIdx >= 0) {
      leases[targetIdx] = target;
      await AsyncStorage.setItem(localKey, JSON.stringify(leases));
    } else {
      await AsyncStorage.setItem(localKey, JSON.stringify([target, ...leases]));
    }

    // Also auto-save a unit document reference for the signed lease!
    if (target.status === "active" || signerRole === "landlord") {
      await saveUnitDocumentLocally({
        document_id: `doc_lease_${target.lease_id}`,
        unit_id: unitId,
        building_id: target.building_id,
        lease_id: target.lease_id,
        document_title: `${target.title} - Signed (${target.tenant_name})`,
        document_type: "lease_agreement",
        file_url: signatureDataUri,
        uploaded_by_id: target.landlord_id,
        uploaded_by_role: "landlord",
        created_at: now,
      });
    }

    // Sync to Backend API
    try {
      const fd = new FormData();
      fd.append("lease_id", String(leaseId));
      fd.append("unit_id", String(unitId));
      fd.append("signer_role", signerRole);
      fd.append("signer_name", signerName);
      fd.append("signature", signatureDataUri);
      fd.append("status", target.status);

      const res = await axios.post(`${API_URL}/api/landlord/lease/sign`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 8000,
      });

      if (res.data && res.data.lease) {
        const fromDb = normalizeLeaseData(res.data.lease);
        return { ok: true, updatedLease: fromDb };
      }
    } catch (apiErr) {
      console.log("Backend sync notice for lease sign (saved locally):", apiErr);
    }

    return { ok: true, updatedLease: target };
  } catch (err: any) {
    console.error("Error signing lease:", err);
    return { ok: false, message: err?.message || "Could not record signature" };
  }
}

/**
 * Delete a Lease Agreement
 */
export async function deleteLeaseAgreement(
  unitId: number,
  leaseId: string | number
): Promise<boolean> {
  try {
    const localKey = `${LEASES_STORAGE_PREFIX}${unitId}`;
    const leases = await loadUnitLeases(unitId);
    const filtered = leases.filter((l) => String(l.lease_id) !== String(leaseId));
    await AsyncStorage.setItem(localKey, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error("Error deleting lease:", e);
    return false;
  }
}

// ─── UNIT DOCUMENTS VAULT ─────────────────────────────────────────────────────

/**
 * Load all documents attached to a specific unit
 */
export async function loadUnitDocuments(
  unitId: number,
  buildingId?: number | string
): Promise<UnitDocument[]> {
  try {
    const localKey = `${DOCUMENTS_STORAGE_PREFIX}${unitId}`;
    const localRaw = await AsyncStorage.getItem(localKey);
    let docs: UnitDocument[] = localRaw ? JSON.parse(localRaw) : [];

    try {
      const res = await axios.get(`${API_URL}/api/landlord/units/${unitId}/documents`, {
        timeout: 4000,
      });
      if (res.data && Array.isArray(res.data.documents)) {
        docs = res.data.documents;
        await AsyncStorage.setItem(localKey, JSON.stringify(docs));
      }
    } catch (apiErr) {
      // Offline fallback
    }

    return docs;
  } catch (e) {
    console.error("Error loading unit documents:", e);
    return [];
  }
}

/**
 * Save a document record locally
 */
async function saveUnitDocumentLocally(doc: UnitDocument) {
  const localKey = `${DOCUMENTS_STORAGE_PREFIX}${doc.unit_id}`;
  const existing = await loadUnitDocuments(doc.unit_id);
  const idx = existing.findIndex((d) => d.document_id === doc.document_id);
  let updated: UnitDocument[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = doc;
  } else {
    updated = [doc, ...existing];
  }
  await AsyncStorage.setItem(localKey, JSON.stringify(updated));
}

/**
 * Upload & Store a Document tied to a Unit
 */
export async function uploadUnitDocument(
  docData: Omit<UnitDocument, "document_id" | "created_at">
): Promise<{ ok: boolean; document?: UnitDocument; message?: string }> {
  try {
    const newDoc: UnitDocument = {
      ...docData,
      document_id: generateDocId("doc"),
      created_at: new Date().toISOString(),
    };

    // 1. Save locally
    await saveUnitDocumentLocally(newDoc);

    // 2. Upload to Backend API
    try {
      const fd = new FormData();
      fd.append("unit_id", String(newDoc.unit_id));
      fd.append("building_id", String(newDoc.building_id));
      fd.append("document_title", newDoc.document_title);
      fd.append("document_type", newDoc.document_type);
      fd.append("uploaded_by_id", String(newDoc.uploaded_by_id));
      fd.append("uploaded_by_role", newDoc.uploaded_by_role);
      fd.append("file_url", newDoc.file_url);

      await axios.post(`${API_URL}/api/landlord/units/upload_document`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 6000,
      });
    } catch (apiErr) {
      console.log("Backend notice for upload_document (stored locally):", apiErr);
    }

    return { ok: true, document: newDoc };
  } catch (err: any) {
    console.error("Error uploading unit document:", err);
    return { ok: false, message: err?.message || "Could not save document." };
  }
}

/**
 * Delete a Unit Document
 */
export async function deleteUnitDocument(
  unitId: number,
  docId: string
): Promise<boolean> {
  try {
    const localKey = `${DOCUMENTS_STORAGE_PREFIX}${unitId}`;
    const docs = await loadUnitDocuments(unitId);
    const filtered = docs.filter((d) => d.document_id !== docId);
    await AsyncStorage.setItem(localKey, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error("Error deleting unit document:", e);
    return false;
  }
}

/**
 * Look up active lease for a tenant by their phone or email or name
/**
 * Look up active lease for a tenant by their phone or email or name or user ID
 */
export async function findTenantLeases(
  tenantPhone?: string,
  tenantEmail?: string,
  tenantName?: string,
  tenantUserId?: string | number
): Promise<LeaseAgreementData[]> {
  try {
    const normPhone = (p?: string) => (p || "").replace(/\D/g, "");
    const qPhone = normPhone(tenantPhone);
    const qEmail = (tenantEmail || "").trim().toLowerCase();
    const qName = (tenantName || "").trim().toLowerCase();
    const qUserId = tenantUserId ? String(tenantUserId) : "";

    const matchedLeases: LeaseAgreementData[] = [];
    const seenLeaseIds = new Set<string>();

    // 1. Try Fetching from Backend API
    if (tenantUserId || tenantPhone || tenantEmail) {
      try {
        const res = await axios.get(
          `${API_URL}/api/tenant/leases?user_id=${tenantUserId || ""}&phone=${tenantPhone || ""}&email=${tenantEmail || ""}`,
          { timeout: 5000 }
        );
        if (res.data && Array.isArray(res.data.leases)) {
          for (const item of res.data.leases) {
            const parsedLease = normalizeLeaseData(item);
            if (parsedLease.lease_id && !seenLeaseIds.has(String(parsedLease.lease_id))) {
              seenLeaseIds.add(String(parsedLease.lease_id));
              matchedLeases.push(parsedLease);
              if (parsedLease.unit_id) {
                const localKey = `${LEASES_STORAGE_PREFIX}${parsedLease.unit_id}`;
                await AsyncStorage.setItem(localKey, JSON.stringify([parsedLease]));
              }
            }
          }
          if (matchedLeases.length > 0) {
            return matchedLeases;
          }
        }
      } catch (apiErr) {
        console.log("Tenant leases API fetch notice (using cache if exists):", apiErr);
      }
    }

    // 2. Fallback to Local AsyncStorage Caches
    const allKeys = await AsyncStorage.getAllKeys();
    const leaseKeys = allKeys.filter((k) => k.startsWith(LEASES_STORAGE_PREFIX));

    for (const key of leaseKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const list: LeaseAgreementData[] = JSON.parse(raw);
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const itemPhone = normPhone(item.tenant_phone);
          const itemEmail = (item.tenant_email || "").trim().toLowerCase();
          const itemName = (item.tenant_name || "").trim().toLowerCase();
          const itemUserId = item.tenant_id ? String(item.tenant_id) : "";

          const isMatch =
            (qUserId && itemUserId && itemUserId === qUserId) ||
            (qPhone && itemPhone && (itemPhone.includes(qPhone) || qPhone.includes(itemPhone))) ||
            (qEmail && itemEmail && itemEmail === qEmail) ||
            (qName && itemName && (itemName.includes(qName) || qName.includes(itemName)));

          if (isMatch && item.lease_id && !seenLeaseIds.has(String(item.lease_id))) {
            seenLeaseIds.add(String(item.lease_id));
            matchedLeases.push(normalizeLeaseData(item));
          }
        }
      } catch {}
    }

    return matchedLeases;
  } catch (e) {
    console.error("Error finding tenant leases:", e);
    return [];
  }
}
