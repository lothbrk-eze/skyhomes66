export type TemplateKey =
  | "standard_residential"
  | "furnished_apartment"
  | "commercial_shop"
  | "month_to_month";

export type LeaseClause = {
  id: string;
  title: string;
  content: string;
  isMandatory: boolean;
  isEnabled: boolean;
};

export type MasterLeaseTemplate = {
  key: TemplateKey;
  name: string;
  shortDescription: string;
  icon: string;
  defaultNoticeDays: number;
  clauses: LeaseClause[];
};

export interface LeaseAgreementData {
  lease_id?: string | number;
  unit_id: number;
  building_id: number | string;
  landlord_id: number | string;
  tenant_id?: number | string | null;
  template_type: TemplateKey;
  title: string;

  // Parties
  landlord_name: string;
  landlord_phone: string;
  landlord_email?: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string;
  tenant_id_number?: string;

  // Property Details
  building_name: string;
  building_address?: string;
  building_location?: string;
  unit_code: string;
  unit_type?: string;

  // Financial & Dates
  monthly_rent: number;
  deposit_amount: number;
  rent_due_day: number | string;
  lease_start_date: string;
  lease_end_date?: string;
  notice_period_days: number;

  // Clauses & Custom Terms
  clauses: LeaseClause[];
  custom_terms?: string;

  // E-Signatures
  landlord_signature?: string | null;
  landlord_signed_at?: string | null;
  landlord_signer_name?: string;
  tenant_signature?: string | null;
  tenant_signed_at?: string | null;
  tenant_signer_name?: string;

  // Status & Meta
  status: "draft" | "pending_signatures" | "active" | "expired" | "terminated";
  pdf_url?: string;
  created_at: string;
  updated_at?: string;
}

export const MASTER_LEASE_TEMPLATES: MasterLeaseTemplate[] = [
  {
    key: "standard_residential",
    name: "Standard Residential Tenancy",
    shortDescription: "Ideal for apartments, bedsitters, and residential flats.",
    icon: "home-outline",
    defaultNoticeDays: 30,
    clauses: [
      {
        id: "c_rent",
        title: "1. Rent Payment & Due Date",
        content:
          "The Tenant agrees to pay the agreed monthly rent of KES {{monthly_rent}} on or before the {{rent_due_day}} day of every calendar month. Rent is payable via M-Pesa or designated Landlord bank account without any deductions.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_deposit",
        title: "2. Security Deposit",
        content:
          "The Tenant shall pay a refundable security deposit of KES {{deposit_amount}} upon execution of this Agreement. The deposit shall be refunded within 14 days after vacating, less any deductions for unpaid utility bills or repair costs arising from damages beyond normal wear and tear.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_use",
        title: "3. Permitted Use & Quiet Enjoyment",
        content:
          "The Premises (Unit {{unit_code}}) shall be used exclusively for private residential purposes by the Tenant and immediate family. The Tenant shall not cause excessive noise, disturbance, or nuisance to other occupants of {{building_name}}.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_utilities",
        title: "4. Utilities & Common Services",
        content:
          "The Tenant is responsible for paying their individual electricity tokens and metered water consumption. Shared security and garbage collection services shall be observed according to building management regulations.",
        isMandatory: false,
        isEnabled: true,
      },
      {
        id: "c_maintenance",
        title: "5. Repairs & Maintenance",
        content:
          "The Landlord shall maintain the structural aspects, external walls, and main plumbing/electrical lines. The Tenant agrees to keep the interior of Unit {{unit_code}} in clean, sanitary condition and promptly report any major defects.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_sublet",
        title: "6. Subletting & Alterations",
        content:
          "The Tenant shall not assign, sublet, or transfer possession of the unit, nor make structural alterations or permanent modifications without prior written consent from the Landlord.",
        isMandatory: false,
        isEnabled: true,
      },
      {
        id: "c_termination",
        title: "7. Termination & Notice Period",
        content:
          "Either party may terminate this tenancy by issuing at least {{notice_period_days}} days prior written notice to the other party, or payment of one months rent in lieu of notice. The unit must be handed over in good condition.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_inspection",
        title: "8. Right of Entry & Inspection",
        content:
          "The Landlord or authorized property manager reserves the right to inspect the premises upon giving at least 24 hours prior verbal or written notice, or immediately in case of emergency.",
        isMandatory: false,
        isEnabled: true,
      },
    ],
  },
  {
    key: "furnished_apartment",
    name: "Furnished / Serviced Apartment",
    shortDescription: "Includes furniture & appliances inventory checklist and damage terms.",
    icon: "bed-outline",
    defaultNoticeDays: 14,
    clauses: [
      {
        id: "c_rent_furn",
        title: "1. Rent & Service Charges",
        content:
          "The Tenant agrees to pay KES {{monthly_rent}} monthly in advance. This rate covers occupancy of the fully furnished Unit {{unit_code}} at {{building_name}} including fixtures, high-speed Wi-Fi, and serviced amenities.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_deposit_furn",
        title: "2. Furniture & Damage Deposit",
        content:
          "A security and furniture damage deposit of KES {{deposit_amount}} is held. All furniture, kitchenware, bedding, and electronic appliances listed on the Move-in Inventory Schedule must remain intact upon check-out.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_inventory",
        title: "3. Inventory & Condition Schedule",
        content:
          "The Tenant acknowledges receiving the premises and all listed fittings in excellent working condition. Any damaged, lost, or broken items shall be replaced or deducted from the deposit at replacement value.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_house_rules",
        title: "4. House Rules & No Smoking",
        content:
          "Smoking inside the apartment is strictly prohibited. Maximum guest occupancy must not exceed the agreed limit. Parties and loud gatherings disturbing other residents are prohibited.",
        isMandatory: false,
        isEnabled: true,
      },
      {
        id: "c_termination_furn",
        title: "5. Termination & Check-Out",
        content:
          "Notice of vacation must be provided at least {{notice_period_days}} days in advance. A joint check-out inspection will be conducted before deposit release.",
        isMandatory: true,
        isEnabled: true,
      },
    ],
  },
  {
    key: "commercial_shop",
    name: "Commercial / Shop Lease",
    shortDescription: "For commercial spaces, stalls, offices, and retail units.",
    icon: "briefcase-outline",
    defaultNoticeDays: 60,
    clauses: [
      {
        id: "c_comm_rent",
        title: "1. Commercial Rent & Escalation",
        content:
          "The Tenant agrees to pay monthly rent of KES {{monthly_rent}} strictly on or before day {{rent_due_day}} of each month. Rent may be subject to standard commercial annual escalation as agreed in the Schedule.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_comm_use",
        title: "2. Permitted Commercial Purpose",
        content:
          "Unit {{unit_code}} at {{building_name}} shall be used exclusively for lawful commercial/retail business operations. The Tenant shall secure all necessary county business permits, licenses, and statutory compliances.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_comm_fitout",
        title: "3. Fit-outs & Signage",
        content:
          "Any business signage, interior partitions, branding, or electrical upgrades must be approved in writing by the Landlord/Property Management before installation.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_comm_maintenance",
        title: "4. Internal Maintenance & Security",
        content:
          "The Tenant is responsible for all internal repairs, shutter maintenance, and business property insurance. The Landlord maintains external structures and common corridors.",
        isMandatory: false,
        isEnabled: true,
      },
      {
        id: "c_comm_termination",
        title: "5. Commercial Notice Period",
        content:
          "Either party may terminate this agreement by giving {{notice_period_days}} days prior written notice. The commercial premises must be reinstated to its original open plan layout unless agreed otherwise.",
        isMandatory: true,
        isEnabled: true,
      },
    ],
  },
  {
    key: "month_to_month",
    name: "Month-to-Month Periodic Tenancy",
    shortDescription: "Flexible short-term agreement with standard 30-day rolling renewal.",
    icon: "repeat-outline",
    defaultNoticeDays: 30,
    clauses: [
      {
        id: "c_mtm_rent",
        title: "1. Monthly Rent & Rolling Term",
        content:
          "This Agreement creates a periodic monthly tenancy commencing on {{lease_start_date}} at KES {{monthly_rent}} per month, automatically renewing on a monthly basis until terminated.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_mtm_deposit",
        title: "2. Deposit & Vacating",
        content:
          "The Tenant has paid a deposit of KES {{deposit_amount}}. Either party may end this periodic tenancy at the end of any calendar month by providing {{notice_period_days}} days written notice.",
        isMandatory: true,
        isEnabled: true,
      },
      {
        id: "c_mtm_standard",
        title: "3. Standard Property Rules",
        content:
          "The Tenant agrees to respect all standard building cleanliness, waste disposal, and peaceful occupancy rules of {{building_name}} for Unit {{unit_code}}.",
        isMandatory: true,
        isEnabled: true,
      },
    ],
  },
];

export function renderClauseText(templateText: string, data: Partial<LeaseAgreementData>): string {
  if (!templateText) return "";
  let rendered = templateText;
  rendered = rendered.replace(/\{\{monthly_rent\}\}/g, Number(data.monthly_rent || 0).toLocaleString());
  rendered = rendered.replace(/\{\{deposit_amount\}\}/g, Number(data.deposit_amount || 0).toLocaleString());
  rendered = rendered.replace(/\{\{rent_due_day\}\}/g, String(data.rent_due_day || 5));
  rendered = rendered.replace(/\{\{unit_code\}\}/g, data.unit_code || "N/A");
  rendered = rendered.replace(/\{\{building_name\}\}/g, data.building_name || "the Property");
  rendered = rendered.replace(/\{\{landlord_name\}\}/g, data.landlord_name || "Landlord");
  rendered = rendered.replace(/\{\{tenant_name\}\}/g, data.tenant_name || "Tenant");
  rendered = rendered.replace(/\{\{lease_start_date\}\}/g, data.lease_start_date || "Start Date");
  rendered = rendered.replace(/\{\{lease_end_date\}\}/g, data.lease_end_date || "Continuous");
  rendered = rendered.replace(/\{\{notice_period_days\}\}/g, String(data.notice_period_days || 30));
  return rendered;
}
