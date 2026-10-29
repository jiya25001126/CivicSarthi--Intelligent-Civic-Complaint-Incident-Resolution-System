import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../data');

export const SEED_DEPARTMENTS = [
  {
    id: "DEPT_ROADS",
    code: "PWD",
    name: "Public Works Department (Roads & Infrastructure)",
    description: "Responsible for state highways, major district roads, bridges, and public infrastructure maintenance.",
    category: "roads",
    contactEmail: "nodal.pwd@synthetic-gov.internal",
    isActive: true,
    slaDays: 30
  },
  {
    id: "DEPT_POWER",
    code: "DISCOM",
    name: "Electricity Department (State Power Distribution)",
    description: "Handles high and low-tension grid distribution, transformers, residential meters, and outage restoration.",
    category: "electricity",
    contactEmail: "nodal.power@synthetic-gov.internal",
    isActive: true,
    slaDays: 15
  },
  {
    id: "DEPT_WATER",
    code: "JAL_BOARD",
    name: "Water Supply Department (Municipal Jal Board)",
    description: "Manages potable drinking water pipeline distribution, water treatment plants, and sewer networks.",
    category: "water",
    contactEmail: "nodal.water@synthetic-gov.internal",
    isActive: true,
    slaDays: 15
  },
  {
    id: "DEPT_HEALTH",
    code: "MOHFW",
    name: "Health Department (Directorate of Health Services)",
    description: "Supervises government civil hospitals, primary health centres, drug availability, and public health schemes.",
    category: "healthcare",
    contactEmail: "nodal.health@synthetic-gov.internal",
    isActive: true,
    slaDays: 15
  },
  {
    id: "DEPT_SCHOLARSHIP",
    code: "DHE",
    name: "Education Department (Higher Education & Scholarships)",
    description: "Administers student welfare stipends, DBT scholarship disbursement, and government educational institutes.",
    category: "scholarship",
    contactEmail: "nodal.education@synthetic-gov.internal",
    isActive: true,
    slaDays: 21
  },
  {
    id: "DEPT_REVENUE",
    code: "REV",
    name: "Revenue Department (Land & District Administration)",
    description: "Handles land records, demarcation, certificates, revenue disputes, and district ex-gratia relief.",
    category: "revenue",
    contactEmail: "nodal.revenue@synthetic-gov.internal",
    isActive: true,
    slaDays: 30
  },
  {
    id: "DEPT_MUNICIPAL",
    code: "MC",
    name: "Municipal Corporation (Urban Local Body)",
    description: "Oversees municipal sanitation, solid waste collection, street lighting, drainage cleaning, and parks.",
    category: "municipal",
    contactEmail: "nodal.municipal@synthetic-gov.internal",
    isActive: true,
    slaDays: 10
  },
  {
    id: "DEPT_PENSION",
    code: "DOPPW",
    name: "Social Welfare & Pension Department",
    description: "Coordinates senior citizen pensions, disability pensions, widow benefits, and pensioner grievance resolution.",
    category: "pension",
    contactEmail: "nodal.pension@synthetic-gov.internal",
    isActive: true,
    slaDays: 30
  },
  {
    id: "DEPT_POLICE",
    code: "POLICE",
    name: "Police Department (Civic Liaison & Traffic)",
    description: "Manages civic grievance verification, traffic bottleneck enforcement, and public safety coordination.",
    category: "police",
    contactEmail: "nodal.police@synthetic-gov.internal",
    isActive: true,
    slaDays: 7
  },
  {
    id: "DEPT_RATION",
    code: "DFPD",
    name: "Department of Food & Public Distribution (PDS)",
    description: "Regulates Fair Price Shops (FPS), e-PoS ration distribution, and NFSA consumer food grain allocation.",
    category: "ration",
    contactEmail: "nodal.ration@synthetic-gov.internal",
    isActive: true,
    slaDays: 20
  },
  {
    id: "DEPT_DISASTER",
    code: "DDMA",
    name: "Disaster Management Authority",
    description: "Coordinates emergency crisis response, monsoon flood rescue, ex-gratia distribution, and relief shelters.",
    category: "flood relief",
    contactEmail: "nodal.disaster@synthetic-gov.internal",
    isActive: true,
    slaDays: 7
  }
];

export const SEED_COMPLAINTS = [
  {
    id: "CPG-2026-00101",
    referenceNumber: "CS-2026-0001",
    title: "Family Pension Disbursement Delay Post-Superannuation",
    description: "Family pension has not been credited for the past four months after spouse retired from central civil services. PPO generation is delayed at the zonal accounts office.",
    text: "Family pension has not been credited for the past four months after spouse retired from central civil services. PPO generation is delayed at the zonal accounts office.",
    category: "pension",
    state: "Maharashtra",
    district: "Pune",
    locality: "Kothrud Colony, Sector 4",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_PENSION",
    department: "DEPT_PENSION",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    officialStatus: "FORWARDED_TO_SUBORDINATE_OFFICE",
    createdAt: "2026-01-15T09:30:00.000Z",
    updatedAt: "2026-02-01T14:20:00.000Z",
    lastUpdated: "2026-02-01T14:20:00.000Z",
    reassignments: 3,
    citizenReminders: 4,
    evidence: ["pension_sanction_order_ref_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-01-15T09:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted by citizen" },
      { timestamp: "2026-01-18T11:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Zonal Pension Redressal Officer" },
      { timestamp: "2026-02-01T14:20:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Cross-verifying PPO sanction status with Treasury" }
    ],
    officerNotes: [
      { timestamp: "2026-02-01T14:25:00.000Z", note: "Treasury reconciliation letter issued on 29 Jan. Awaiting clearance.", officerId: "OFF_001" }
    ]
  },
  {
    id: "CPG-2026-00102",
    referenceNumber: "CS-2026-0002",
    title: "Discrepancy in Revised Dearness Relief Calculation",
    description: "Dearness relief arrears calculation incorrect in revised pension payment order. Seeking revision of revised basic entitlement according to 7th CPC matrix.",
    text: "Dearness relief arrears calculation incorrect in revised pension payment order. Seeking revision of revised basic entitlement according to 7th CPC matrix.",
    category: "pension",
    state: "Uttar Pradesh",
    district: "Lucknow",
    locality: "Aliganj, Block B",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_PENSION",
    department: "DEPT_PENSION",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_PROCESS",
    createdAt: "2026-08-20T10:15:00.000Z",
    updatedAt: "2026-09-15T11:00:00.000Z",
    lastUpdated: "2026-09-15T11:00:00.000Z",
    reassignments: 1,
    citizenReminders: 1,
    evidence: ["bank_passbook_entry_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-08-20T10:15:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Initial submission by pensioner" },
      { timestamp: "2026-08-22T09:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Accounts Calculation Desk" },
      { timestamp: "2026-09-15T11:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Audit verification in progress" }
    ],
    officerNotes: [
      { timestamp: "2026-09-15T11:05:00.000Z", note: "Re-computing entitlement sheet using updated formula table.", officerId: "OFF_001" }
    ]
  },
  {
    id: "CPG-2026-00103",
    referenceNumber: "CS-2026-0003",
    title: "Jeevan Pramaan Digital Life Certificate Not Mapped at Branch",
    description: "Life certificate submitted via Jeevan Pramaan biometric portal last month but bank branch still marked status as non-compliant and stopped monthly disbursement.",
    text: "Life certificate submitted via Jeevan Pramaan biometric portal last month but bank branch still marked status as non-compliant and stopped monthly disbursement.",
    category: "pension",
    state: "Karnataka",
    district: "Bengaluru Urban",
    locality: "Jayanagar 4th Block",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_PENSION",
    department: "DEPT_PENSION",
    priority: "CRITICAL",
    status: "SUBMITTED",
    officialStatus: "RECEIVED",
    createdAt: "2026-09-28T08:00:00.000Z",
    updatedAt: "2026-09-28T08:00:00.000Z",
    lastUpdated: "2026-09-28T08:00:00.000Z",
    reassignments: 0,
    citizenReminders: 2,
    evidence: ["jeevan_pramaan_ack_synth.png"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-28T08:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted by senior citizen" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00104",
    referenceNumber: "CS-2026-0004",
    title: "Post-Matric Scholarship DBT Pending Verification",
    description: "Post-matric scholarship DBT disbursement pending for academic year 2025-26 despite biometric institute verification completed in portal 5 months ago.",
    text: "Post-matric scholarship DBT disbursement pending for academic year 2025-26 despite biometric institute verification completed in portal 5 months ago.",
    category: "scholarship",
    state: "Bihar",
    district: "Patna",
    locality: "Rajendra Nagar, Lane 3",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_SCHOLARSHIP",
    department: "DEPT_SCHOLARSHIP",
    priority: "HIGH",
    status: "ASSIGNED",
    officialStatus: "TRANSFERRED",
    createdAt: "2026-03-10T12:00:00.000Z",
    updatedAt: "2026-04-12T16:45:00.000Z",
    lastUpdated: "2026-04-12T16:45:00.000Z",
    reassignments: 4,
    citizenReminders: 5,
    evidence: ["institute_bonafide_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-03-10T12:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Student grievance registered" },
      { timestamp: "2026-03-25T14:00:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Under review at district scholarship cell" },
      { timestamp: "2026-04-12T16:45:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Forwarded to State DBT Disbursement Cell" }
    ],
    officerNotes: [
      { timestamp: "2026-04-12T16:50:00.000Z", note: "PFMS batch integration pending portal sync.", officerId: "OFF_002" }
    ]
  },
  {
    id: "CPG-2026-00105",
    referenceNumber: "CS-2026-0005",
    title: "Duplicate Application Error Code on Higher Ed Portal",
    description: "Merit-cum-means scholarship status displaying duplicate application error code ERR_409 even though only one valid registration ID was filed.",
    text: "Merit-cum-means scholarship status displaying duplicate application error code ERR_409 even though only one valid registration ID was filed.",
    category: "scholarship",
    state: "Delhi",
    district: "Central Delhi",
    locality: "Karol Bagh",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_SCHOLARSHIP",
    department: "DEPT_SCHOLARSHIP",
    priority: "MEDIUM",
    status: "AWAITING_INFORMATION",
    officialStatus: "PENDING_CLARIFICATION",
    createdAt: "2026-09-02T11:30:00.000Z",
    updatedAt: "2026-09-18T10:15:00.000Z",
    lastUpdated: "2026-09-18T10:15:00.000Z",
    reassignments: 1,
    citizenReminders: 1,
    evidence: ["portal_screensnip_synth.png"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-02T11:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted" },
      { timestamp: "2026-09-05T10:00:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Technical validation initiated" },
      { timestamp: "2026-09-18T10:15:00.000Z", status: "AWAITING_INFORMATION", actorType: "OFFICER", remarks: "Requested copy of previous year roll number from student" }
    ],
    officerNotes: [
      { timestamp: "2026-09-18T10:20:00.000Z", note: "Citizen notified via SMS to provide previous roll number.", officerId: "OFF_002" }
    ]
  },
  {
    id: "CPG-2026-00106",
    referenceNumber: "CS-2026-0006",
    title: "Hazardous Potholes and Crater Cluster on Arterial Bypass",
    description: "Heavy crater pothole cluster on Sector-12 ring arterial road causing multiple two-wheeler accidents during evening commute. Immediate road resurfacing needed.",
    text: "Heavy crater pothole cluster on Sector-12 ring arterial road causing multiple two-wheeler accidents during evening commute. Immediate road resurfacing needed.",
    category: "roads",
    state: "Madhya Pradesh",
    district: "Indore",
    locality: "Ring Road Sector 12",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "INTERIM_REPLY",
    createdAt: "2026-02-18T07:45:00.000Z",
    updatedAt: "2026-03-05T17:30:00.000Z",
    lastUpdated: "2026-03-05T17:30:00.000Z",
    reassignments: 3,
    citizenReminders: 6,
    evidence: ["road_pothole_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-02-18T07:45:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Citizen emergency road hazard report" },
      { timestamp: "2026-02-19T10:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Sub-Divisional Engineer" },
      { timestamp: "2026-03-05T17:30:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Cold-mix patch repair work issued under tender" }
    ],
    officerNotes: [
      { timestamp: "2026-03-05T17:35:00.000Z", note: "Emergency gravel filling completed. Bituminous macadam scheduled.", officerId: "OFF_003" }
    ]
  },
  {
    id: "CPG-2026-00107",
    referenceNumber: "CS-2026-0007",
    title: "Unbarricaded Open Storm Water Trench Along Service Lane",
    description: "Unfinished drainage excavation along Main Bypass service lane left without warning barricades or reflector signage for 3 weeks.",
    text: "Unfinished drainage excavation along Main Bypass service lane left without warning barricades or reflector signage for 3 weeks.",
    category: "roads",
    state: "Haryana",
    district: "Gurugram",
    locality: "Sohna Road Junction",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    officialStatus: "FORWARDED_TO_SUBORDINATE_OFFICE",
    createdAt: "2026-09-10T15:20:00.000Z",
    updatedAt: "2026-09-29T11:10:00.000Z",
    lastUpdated: "2026-09-29T11:10:00.000Z",
    reassignments: 2,
    citizenReminders: 2,
    evidence: ["drainage_trench_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-10T15:20:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Complaint submitted" },
      { timestamp: "2026-09-29T11:10:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Contractor safety inspection ordered" }
    ],
    officerNotes: [
      { timestamp: "2026-09-29T11:15:00.000Z", note: "Show cause notice sent to contractor for lack of safety barricades.", officerId: "OFF_003" }
    ]
  },
  {
    id: "CPG-2026-00108",
    referenceNumber: "CS-2026-0008",
    title: "Rectification of Non-Standard IRC Speed Breaker",
    description: "Faulty speed breaker installation constructed without standard IRC height specifications causing undercarriage damage to light vehicles.",
    text: "Faulty speed breaker installation constructed without standard IRC height specifications causing undercarriage damage to light vehicles.",
    category: "roads",
    state: "Tamil Nadu",
    district: "Chennai",
    locality: "Anna Nagar West",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "LOW",
    status: "RESOLVED",
    officialStatus: "RESOLVED",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-25T16:00:00.000Z",
    lastUpdated: "2026-08-25T16:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["resident_association_letter_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-08-01T09:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted" },
      { timestamp: "2026-08-05T10:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Inspected by road maintenance squad" },
      { timestamp: "2026-08-25T16:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "Speed breaker remodeled according to IRC standards and painted with thermoplastic reflective strips." }
    ],
    officerNotes: [
      { timestamp: "2026-08-25T16:05:00.000Z", note: "Physical completion report signed by Assistant Engineer.", officerId: "OFF_003" }
    ]
  },
  {
    id: "CPG-2026-00109",
    referenceNumber: "CS-2026-0009",
    title: "Distribution Transformer Burnout and Low-Tension Blackout",
    description: "Distribution transformer explosion in Ward 9 causing 48 hours continuous blackout and surging voltage damaging household electronic appliances.",
    text: "Distribution transformer explosion in Ward 9 causing 48 hours continuous blackout and surging voltage damaging household electronic appliances.",
    category: "electricity",
    state: "Rajasthan",
    district: "Jaipur",
    locality: "Ward 9, Malviya Nagar",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POWER",
    department: "DEPT_POWER",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_PROCESS",
    createdAt: "2026-10-06T18:00:00.000Z",
    updatedAt: "2026-10-07T12:00:00.000Z",
    lastUpdated: "2026-10-07T12:00:00.000Z",
    reassignments: 1,
    citizenReminders: 3,
    evidence: ["transformer_burnt_ref_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-06T18:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Blackout reported" },
      { timestamp: "2026-10-07T08:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Sub-Station Maintenance Team" },
      { timestamp: "2026-10-07T12:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Mobile transformer replacement unit dispatched" }
    ],
    officerNotes: [
      { timestamp: "2026-10-07T12:10:00.000Z", note: "250 kVA replacement transformer loaded onto crane truck.", officerId: "OFF_004" }
    ]
  },
  {
    id: "CPG-2026-00110",
    referenceNumber: "CS-2026-0010",
    title: "Erroneous High Consumption on Locked Premises Smart Meter",
    description: "Faulty smart meter billing showing 1200 units consumption for a locked residential unit for two consecutive billing cycles.",
    text: "Faulty smart meter billing showing 1200 units consumption for a locked residential unit for two consecutive billing cycles.",
    category: "electricity",
    state: "Gujarat",
    district: "Ahmedabad",
    locality: "Navrangpura, Flat 302",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POWER",
    department: "DEPT_POWER",
    priority: "MEDIUM",
    status: "UNDER_REVIEW",
    officialStatus: "TRANSFERRED",
    createdAt: "2026-04-14T11:20:00.000Z",
    updatedAt: "2026-05-02T13:40:00.000Z",
    lastUpdated: "2026-05-02T13:40:00.000Z",
    reassignments: 3,
    citizenReminders: 3,
    evidence: ["discom_bill_statement_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-04-14T11:20:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Billing complaint lodged" },
      { timestamp: "2026-05-02T13:40:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Smart meter telemetry logs requested from IT vendor" }
    ],
    officerNotes: [
      { timestamp: "2026-05-02T13:45:00.000Z", note: "Suspected optical pulse sensor glitch.", officerId: "OFF_004" }
    ]
  },
  {
    id: "CPG-2026-00111",
    referenceNumber: "CS-2026-0011",
    title: "Severe Sewage Odor and Contamination in Potable Water Supply",
    description: "Contaminated yellowish tap water with strong sewage odor supplied to residential colony blocks C and D for past five days.",
    text: "Contaminated yellowish tap water with strong sewage odor supplied to residential colony blocks C and D for past five days.",
    category: "water",
    state: "Telangana",
    district: "Hyderabad",
    locality: "Amberpet, Blocks C & D",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_PROCESS",
    createdAt: "2026-10-04T08:30:00.000Z",
    updatedAt: "2026-10-06T10:15:00.000Z",
    lastUpdated: "2026-10-06T10:15:00.000Z",
    reassignments: 1,
    citizenReminders: 2,
    evidence: ["water_turbidity_sample_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-04T08:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Contamination hazard reported" },
      { timestamp: "2026-10-05T09:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Zonal Water Quality Testing Lab" },
      { timestamp: "2026-10-06T10:15:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Pipeline breach detected near sewage crossing. Repair crew on site." }
    ],
    officerNotes: [
      { timestamp: "2026-10-06T10:20:00.000Z", note: "Water samples sent for biological testing. Temporary tanker supply organized.", officerId: "OFF_005" }
    ]
  },
  {
    id: "CPG-2026-00112",
    referenceNumber: "CS-2026-0012",
    title: "Non-Delivery of Scheduled Emergency Municipal Water Tanker",
    description: "Water tanker emergency booking token generated 48 hours ago but no tanker dispatched to Sector-5 community housing.",
    text: "Water tanker emergency booking token generated 48 hours ago but no tanker dispatched to Sector-5 community housing.",
    category: "water",
    state: "Maharashtra",
    district: "Thane",
    locality: "Ghodbunder Road, Sector 5",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "MEDIUM",
    status: "RESOLVED",
    officialStatus: "CLOSED",
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: "2026-07-15T18:00:00.000Z",
    lastUpdated: "2026-07-15T18:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["tanker_slip_token_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-07-10T10:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Complaint submitted" },
      { timestamp: "2026-07-12T14:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Tanker route scheduled" },
      { timestamp: "2026-07-15T18:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "10,000L tanker delivery completed. Signature obtained from resident representative." }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00113",
    referenceNumber: "CS-2026-0013",
    title: "e-PoS Connectivity Failure and Grain Denial at Fair Price Shop",
    description: "Fair Price Shop dealer refusing subsidized wheat and rice allocation citing electronic e-PoS biometric server disconnection.",
    text: "Fair Price Shop dealer refusing subsidized wheat and rice allocation citing electronic e-PoS biometric server disconnection.",
    category: "ration",
    state: "Uttar Pradesh",
    district: "Varanasi",
    locality: "Shivpur Ward, Shop 88",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_RATION",
    department: "DEPT_RATION",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    officialStatus: "PENDING_CLARIFICATION",
    createdAt: "2026-09-15T13:00:00.000Z",
    updatedAt: "2026-09-28T16:30:00.000Z",
    lastUpdated: "2026-09-28T16:30:00.000Z",
    reassignments: 1,
    citizenReminders: 2,
    evidence: ["ration_card_copy_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-15T13:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "NFSA beneficiary filed grievance" },
      { timestamp: "2026-09-28T16:30:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Area food inspector assigned to audit FPS e-PoS machine" }
    ],
    officerNotes: [
      { timestamp: "2026-09-28T16:35:00.000Z", note: "Dealer instructed to use offline OTP fallback mode.", officerId: "OFF_006" }
    ]
  },
  {
    id: "CPG-2026-00114",
    referenceNumber: "CS-2026-0014",
    title: "Stock Depletion of Essential Chronic Disease Medications at PHC",
    description: "Primary Health Centre lacks essential insulin and hypertension medications for senior citizens for over three weeks.",
    text: "Primary Health Centre lacks essential insulin and hypertension medications for senior citizens for over three weeks.",
    category: "healthcare",
    state: "Kerala",
    district: "Thiruvananthapuram",
    locality: "Vattiyoorkavu PHC",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_HEALTH",
    department: "DEPT_HEALTH",
    priority: "HIGH",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_PROCESS",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-10-02T12:00:00.000Z",
    lastUpdated: "2026-10-02T12:00:00.000Z",
    reassignments: 2,
    citizenReminders: 1,
    evidence: ["doctor_prescription_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-20T10:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Medical supplies shortage reported" },
      { timestamp: "2026-10-02T12:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Emergency indents placed with Central Medical Services Society" }
    ],
    officerNotes: [
      { timestamp: "2026-10-02T12:05:00.000Z", note: "Stock shipment dispatched from central depot on Oct 1.", officerId: "OFF_007" }
    ]
  },
  {
    id: "CPG-2026-00115",
    referenceNumber: "CS-2026-0015",
    title: "Denial of Cashless Admission Under PM-JAY Ayushman Bharat",
    description: "Denial of cashless admission under Ayushman Bharat scheme at empanelled hospital for urgent cardiac stent surgery.",
    text: "Denial of cashless admission under Ayushman Bharat scheme at empanelled hospital for urgent cardiac stent surgery.",
    category: "healthcare",
    state: "Bihar",
    district: "Gaya",
    locality: "City Medical Hospital, Ward 15",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_HEALTH",
    department: "DEPT_HEALTH",
    priority: "CRITICAL",
    status: "UNDER_REVIEW",
    officialStatus: "INTERIM_REPLY",
    createdAt: "2026-02-10T16:00:00.000Z",
    updatedAt: "2026-02-28T09:30:00.000Z",
    lastUpdated: "2026-02-28T09:30:00.000Z",
    reassignments: 4,
    citizenReminders: 7,
    evidence: ["pmjay_gold_card_synth.pdf", "admission_refusal_slip_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-02-10T16:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Critical hospital admission refusal lodged" },
      { timestamp: "2026-02-28T09:30:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "State Health Agency issuing inquiry to empanelled hospital" }
    ],
    officerNotes: [
      { timestamp: "2026-02-28T09:35:00.000Z", note: "Hospital administration summoned for explanation of guideline violation.", officerId: "OFF_007" }
    ]
  },
  {
    id: "CPG-2026-00116",
    referenceNumber: "CS-2026-0016",
    title: "Flash Flood Submersion and Power Line Disconnection",
    description: "Flash flood inundation in North Ward: Flood water submerged residential ground floors; power transformers shut down leaving 400 families in dark; clean drinking water pipeline snapped.",
    text: "Flash flood inundation in North Ward: Flood water submerged residential ground floors; power transformers shut down leaving 400 families in dark; clean drinking water pipeline snapped.",
    category: "flood relief",
    state: "Assam",
    district: "Kamrup Metropolitan",
    locality: "North Guwahati, Ward 4",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_DISASTER",
    department: "DEPT_DISASTER",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_PROCESS",
    createdAt: "2026-10-05T04:30:00.000Z",
    updatedAt: "2026-10-07T11:00:00.000Z",
    lastUpdated: "2026-10-07T11:00:00.000Z",
    reassignments: 1,
    citizenReminders: 5,
    evidence: ["north_ward_flood_photo1_synth.jpg", "inundation_survey_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-05T04:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Disaster emergency alert filed" },
      { timestamp: "2026-10-05T06:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to District Disaster Relief Cell" },
      { timestamp: "2026-10-07T11:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Relief boats and portable de-watering pumps deployed" }
    ],
    officerNotes: [
      { timestamp: "2026-10-07T11:05:00.000Z", note: "Submersible pump installed. Water receded by 1.5 feet.", officerId: "OFF_008" }
    ]
  },
  {
    id: "CPG-2026-00117",
    referenceNumber: "CS-2026-0017",
    title: "Debris Clearance and Emergency Rations for Displaced Families",
    description: "Flood water breached river embankment near East Crossing: Major road bridge blocked by debris; emergency food rations not reaching relief camp; displaced senior citizens lack medical care.",
    text: "Flood water breached river embankment near East Crossing: Major road bridge blocked by debris; emergency food rations not reaching relief camp; displaced senior citizens lack medical care.",
    category: "flood relief",
    state: "Assam",
    district: "Kamrup Metropolitan",
    locality: "East Crossing Relief Shelter",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_DISASTER",
    department: "DEPT_DISASTER",
    priority: "CRITICAL",
    status: "UNDER_REVIEW",
    officialStatus: "FORWARDED_TO_SUBORDINATE_OFFICE",
    createdAt: "2026-10-05T06:15:00.000Z",
    updatedAt: "2026-10-07T09:30:00.000Z",
    lastUpdated: "2026-10-07T09:30:00.000Z",
    reassignments: 2,
    citizenReminders: 4,
    evidence: ["river_breach_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-05T06:15:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "River breach crisis reported" },
      { timestamp: "2026-10-07T09:30:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Multi-agency coordination initiated with PWD & Health" }
    ],
    officerNotes: [
      { timestamp: "2026-10-07T09:35:00.000Z", note: "Medical officers team dispatched to camp.", officerId: "OFF_008" }
    ]
  },
  {
    id: "CPG-2026-00118",
    referenceNumber: "CS-2026-0018",
    title: "Illegal Waste Dumping and Overflowing Community Dumpster",
    description: "Commercial establishments dumping construction debris and commercial refuse into residential municipal bins, obstructing pedestrian walkway and creating pest infestation.",
    text: "Commercial establishments dumping construction debris and commercial refuse into residential municipal bins, obstructing pedestrian walkway and creating pest infestation.",
    category: "municipal",
    state: "Delhi",
    district: "South Delhi",
    locality: "Lajpat Nagar IV",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_MUNICIPAL",
    department: "DEPT_MUNICIPAL",
    priority: "MEDIUM",
    status: "ASSIGNED",
    officialStatus: "RECEIVED",
    createdAt: "2026-10-07T11:00:00.000Z",
    updatedAt: "2026-10-08T09:00:00.000Z",
    lastUpdated: "2026-10-08T09:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["garbage_dump_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-07T11:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Sanitation grievance registered" },
      { timestamp: "2026-10-08T09:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Ward Sanitation Superintendent" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00119",
    referenceNumber: "CS-2026-0019",
    title: "Contaminated Municipal Tap Water with High Turbidity and Odor",
    description: "Tap water supplied in morning hours is muddy brown with a foul chemical odor. Multiple households in Gadital colony reporting gastroenteritis symptoms. Urgent testing and line flushing needed.",
    text: "Tap water supplied in morning hours is muddy brown with a foul chemical odor. Multiple households in Gadital colony reporting gastroenteritis symptoms. Urgent testing and line flushing needed.",
    category: "water",
    state: "Maharashtra",
    district: "Pune",
    locality: "Hadapsar, Gadital Phase 2",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "CRITICAL",
    status: "SUBMITTED",
    officialStatus: "RECEIVED",
    createdAt: "2026-10-12T06:30:00.000Z",
    updatedAt: "2026-10-12T06:30:00.000Z",
    lastUpdated: "2026-10-12T06:30:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["tap_water_contamination_sample_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-12T06:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Emergency water contamination report lodged" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00120",
    referenceNumber: "CS-2026-0020",
    title: "Main Drinking Water Pipeline Rupture Flooding Pedestrian Walkway",
    description: "Feeder main water pipe ruptured opposite Balewadi Phata, wasting hundreds of kilolitres of drinking water and flooding the arterial road. Low water pressure reported across downstream societies.",
    text: "Feeder main water pipe ruptured opposite Balewadi Phata, wasting hundreds of kilolitres of drinking water and flooding the arterial road. Low water pressure reported across downstream societies.",
    category: "water",
    state: "Maharashtra",
    district: "Pune",
    locality: "Baner Road, Near Balewadi Phata",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "HIGH",
    status: "IN_PROGRESS",
    officialStatus: "UNDER_RESTORATION",
    createdAt: "2026-10-11T08:15:00.000Z",
    updatedAt: "2026-10-12T14:00:00.000Z",
    lastUpdated: "2026-10-12T14:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["pipeline_burst_geyser_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-11T08:15:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Pipeline rupture reported" },
      { timestamp: "2026-10-11T09:30:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Jal Board Emergency Response Unit" },
      { timestamp: "2026-10-12T14:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Excavation completed, pipeline clamp replacement underway" }
    ],
    officerNotes: [
      { timestamp: "2026-10-12T14:05:00.000Z", note: "300mm ductile iron sleeve fitted; hydro-testing scheduled before evening backfill.", officerId: "OFF_WATER_01" }
    ]
  },
  {
    id: "CPG-2026-00121",
    referenceNumber: "CS-2026-0021",
    title: "Persistent Inadequate Pressure at Tail-End Drinking Water Distribution Line",
    description: "Water pressure has deteriorated over the last 3 weeks in Datta Mandir area. Upper floor apartments receive zero water during designated 6 AM to 8 AM supply hours.",
    text: "Water pressure has deteriorated over the last 3 weeks in Datta Mandir area. Upper floor apartments receive zero water during designated 6 AM to 8 AM supply hours.",
    category: "water",
    state: "Maharashtra",
    district: "Pune",
    locality: "Wakad, Datta Mandir Road",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "MEDIUM",
    status: "AWAITING_INFORMATION",
    officialStatus: "INFO_REQUESTED",
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-11T16:30:00.000Z",
    lastUpdated: "2026-10-11T16:30:00.000Z",
    reassignments: 1,
    citizenReminders: 2,
    evidence: ["pressure_gauge_zero_reading_synth.png"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-09T10:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Low pressure complaint registered" },
      { timestamp: "2026-10-10T11:00:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Assessing zonal booster pump scheduling" },
      { timestamp: "2026-10-11T16:30:00.000Z", status: "AWAITING_INFORMATION", actorType: "OFFICER", remarks: "Requested consumer connection numbers and elevation details from society secretary" }
    ],
    officerNotes: [
      { timestamp: "2026-10-11T16:35:00.000Z", note: "Checking if localized illegal booster pumps are drawing suction from the main line.", officerId: "OFF_WATER_02" }
    ]
  },
  {
    id: "CPG-2026-00122",
    referenceNumber: "CS-2026-0022",
    title: "Defective Bulk Flow Meter Generating Erroneous Consumption Assessment",
    description: "Housing society bulk water meter recorded 4x average monthly consumption despite occupancy reduction during festive holidays. Physical inspection confirmed mechanical gear slippage.",
    text: "Housing society bulk water meter recorded 4x average monthly consumption despite occupancy reduction during festive holidays. Physical inspection confirmed mechanical gear slippage.",
    category: "water",
    state: "Maharashtra",
    district: "Pune",
    locality: "Kalyani Nagar, Central Avenue",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_WATER",
    department: "DEPT_WATER",
    priority: "HIGH",
    status: "RESOLVED",
    officialStatus: "RECTIFIED",
    createdAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-10-08T17:00:00.000Z",
    lastUpdated: "2026-10-08T17:00:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["meter_inspection_slip_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-28T09:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Meter inaccuracy dispute submitted" },
      { timestamp: "2026-10-02T12:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Meter testing bench inspection initiated" },
      { timestamp: "2026-10-08T17:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "Calibrated ultrasonic meter installed; revised billing credit voucher issued" }
    ],
    officerNotes: [
      { timestamp: "2026-10-08T17:05:00.000Z", note: "Billed units revised from 1250 kL to historical average of 310 kL. Consumer acknowledged sign-off.", officerId: "OFF_WATER_01" }
    ]
  },
  {
    id: "CPG-2026-00123",
    referenceNumber: "CS-2026-0023",
    title: "Road Crust Cave-in Near Stormwater Trench on High-Traffic Arterial",
    description: "Sudden settlement and cavity formation in asphalt crust following stormwater drain backfilling. Vehicles bottoming out; imminent risk of severe cave-in during evening peak traffic.",
    text: "Sudden settlement and cavity formation in asphalt crust following stormwater drain backfilling. Vehicles bottoming out; imminent risk of severe cave-in during evening peak traffic.",
    category: "roads",
    state: "Maharashtra",
    district: "Pune",
    locality: "Senapati Bapat Road, Near ICC Tech Park",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "SITE_BARRICADED",
    createdAt: "2026-10-13T07:00:00.000Z",
    updatedAt: "2026-10-13T11:30:00.000Z",
    lastUpdated: "2026-10-13T11:30:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["road_depression_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-13T07:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Critical road cave-in reported" },
      { timestamp: "2026-10-13T08:15:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Emergency road maintenance squad alerted" },
      { timestamp: "2026-10-13T11:30:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Trench barricaded with retro-reflective cones; wet mix macadam backfill in progress" }
    ],
    officerNotes: [
      { timestamp: "2026-10-13T11:35:00.000Z", note: "Sub-base compaction test satisfactory. Hot mix bituminous top layer scheduled at 23:00 to avoid traffic hold-up.", officerId: "OFF_ROADS_01" }
    ]
  },
  {
    id: "CPG-2026-00124",
    referenceNumber: "CS-2026-0024",
    title: "Unmarked Concrete Speed Breaker Damaging Vehicles and Causing Accidents",
    description: "Newly constructed concrete speed bump lacks mandated thermoplastic retro-reflective paint and warning signs. Two riders injured after dark due to non-visibility.",
    text: "Newly constructed concrete speed bump lacks mandated thermoplastic retro-reflective paint and warning signs. Two riders injured after dark due to non-visibility.",
    category: "roads",
    state: "Maharashtra",
    district: "Pune",
    locality: "DP Road, Kothrud",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    officialStatus: "FIELD_VERIFICATION",
    createdAt: "2026-10-10T14:20:00.000Z",
    updatedAt: "2026-10-11T10:00:00.000Z",
    lastUpdated: "2026-10-11T10:00:00.000Z",
    reassignments: 1,
    citizenReminders: 3,
    evidence: ["unpainted_hump_hazard_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-10T14:20:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Accident hazard reported" },
      { timestamp: "2026-10-11T10:00:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Site inspection scheduled by Assistant Executive Engineer" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00125",
    referenceNumber: "CS-2026-0025",
    title: "Broken Anti-Skid Tiles and Loose Handrail on Pedestrian Foot-Overbridge",
    description: "Heavy pedestrian bridge connecting bus station and suburban railway terminal has several missing ceramic anti-skid steps and loose metal railing, posing slipping hazard.",
    text: "Heavy pedestrian bridge connecting bus station and suburban railway terminal has several missing ceramic anti-skid steps and loose metal railing, posing slipping hazard.",
    category: "roads",
    state: "Maharashtra",
    district: "Pune",
    locality: "Pune Railway Station, South Concourse",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "MEDIUM",
    status: "ASSIGNED",
    officialStatus: "TENDER_ESTIMATE",
    createdAt: "2026-10-08T11:45:00.000Z",
    updatedAt: "2026-10-09T14:00:00.000Z",
    lastUpdated: "2026-10-09T14:00:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["bridge_step_damage_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-08T11:45:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Infrastructure grievance lodged" },
      { timestamp: "2026-10-09T14:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Bridges & Flyovers Division" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00126",
    referenceNumber: "CS-2026-0026",
    title: "Paver Block Settlement and Pothole Resurfacing at Swargate Junction",
    description: "Bus movement caused severe undulating grooves in paver block surface. Resurfacing with mastic asphalt completed and junction re-opened.",
    text: "Bus movement caused severe undulating grooves in paver block surface. Resurfacing with mastic asphalt completed and junction re-opened.",
    category: "roads",
    state: "Maharashtra",
    district: "Pune",
    locality: "Swargate Junction, Near ST Stand",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_ROADS",
    department: "DEPT_ROADS",
    priority: "MEDIUM",
    status: "RESOLVED",
    officialStatus: "COMPLETED",
    createdAt: "2026-09-20T08:30:00.000Z",
    updatedAt: "2026-10-05T18:00:00.000Z",
    lastUpdated: "2026-10-05T18:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["resurfaced_junction_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-20T08:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted" },
      { timestamp: "2026-09-22T10:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Mastic asphalt patch work deployed" },
      { timestamp: "2026-10-05T18:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "Mastic resurfacing inspected and certified by Executive Engineer" }
    ],
    officerNotes: [
      { timestamp: "2026-10-05T18:05:00.000Z", note: "Defect liability period active for 12 months with contractor M/s InfraTech.", officerId: "OFF_ROADS_01" }
    ]
  },
  {
    id: "CPG-2026-00127",
    referenceNumber: "CS-2026-0027",
    title: "Sparking 11kV Distribution Transformer Adjacent to Primary School",
    description: "Continuous arcing and burning electrical smell from 250kVA step-down transformer on roadside pole structure. School children passing within 3 meters; immediate power cutoff and replacement needed.",
    text: "Continuous arcing and burning electrical smell from 250kVA step-down transformer on roadside pole structure. School children passing within 3 meters; immediate power cutoff and replacement needed.",
    category: "electricity",
    state: "Maharashtra",
    district: "Pune",
    locality: "Bhosari Industrial Area, Sector 7",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POWER",
    department: "DEPT_POWER",
    priority: "CRITICAL",
    status: "ASSIGNED",
    officialStatus: "LINE_ISOLATED",
    createdAt: "2026-10-13T09:10:00.000Z",
    updatedAt: "2026-10-13T10:15:00.000Z",
    lastUpdated: "2026-10-13T10:15:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["transformer_sparking_clip_synth.mp4"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-13T09:10:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Critical life-safety hazard reported" },
      { timestamp: "2026-10-13T10:15:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Substation operator alerted; feeder tripped and maintenance gang dispatched" }
    ],
    officerNotes: [
      { timestamp: "2026-10-13T10:20:00.000Z", note: "Bushings ruptured due to external short circuit; replacement transformer unit mobilized from Central Stores.", officerId: "OFF_POWER_01" }
    ]
  },
  {
    id: "CPG-2026-00128",
    referenceNumber: "CS-2026-0028",
    title: "Sagging Overhead High-Tension Conductor Obstructing Farm Machinery",
    description: "Heavy winds tilted an intermediate transmission pole, causing three-phase wires to sag to within 8 feet of ground level across a village approach path.",
    text: "Heavy winds tilted an intermediate transmission pole, causing three-phase wires to sag to within 8 feet of ground level across a village approach path.",
    category: "electricity",
    state: "Maharashtra",
    district: "Pune",
    locality: "Wagholi Rural Fringe, Gat 114",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POWER",
    department: "DEPT_POWER",
    priority: "HIGH",
    status: "SUBMITTED",
    officialStatus: "RECEIVED",
    createdAt: "2026-10-12T15:30:00.000Z",
    updatedAt: "2026-10-12T15:30:00.000Z",
    lastUpdated: "2026-10-12T15:30:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["sagging_powerline_clearance_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-12T15:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Grievance submitted by local gram panchayat member" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00129",
    referenceNumber: "CS-2026-0029",
    title: "Burnt Residential Energy Meter Replaced and Re-energized",
    description: "Internal flashover in static electricity meter caused total blackout to consumer residence. Meter replaced with smart prepaid unit and supply restored within SLA.",
    text: "Internal flashover in static electricity meter caused total blackout to consumer residence. Meter replaced with smart prepaid unit and supply restored within SLA.",
    category: "electricity",
    state: "Maharashtra",
    district: "Pune",
    locality: "Aundh, Anand Park",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POWER",
    department: "DEPT_POWER",
    priority: "MEDIUM",
    status: "RESOLVED",
    officialStatus: "RESTORED",
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-06T15:30:00.000Z",
    lastUpdated: "2026-10-06T15:30:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["meter_replacement_receipt_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-04T12:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Meter fire and power outage logged" },
      { timestamp: "2026-10-04T14:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Technician dispatched for temporary bypass" },
      { timestamp: "2026-10-06T15:30:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "New calibrated smart meter installed and tested" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00130",
    referenceNumber: "CS-2026-0030",
    title: "Severe Waste Accumulation and Overflowing Secondary Garbage Vat",
    description: "Municipal waste compactor truck skipped morning pickup for 4 consecutive days. Decomposed organic garbage overflowing onto vegetable market street, causing acute stench.",
    text: "Municipal waste compactor truck skipped morning pickup for 4 consecutive days. Decomposed organic garbage overflowing onto vegetable market street, causing acute stench.",
    category: "municipal",
    state: "Maharashtra",
    district: "Pune",
    locality: "Shukrawar Peth, Mandai Market",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_MUNICIPAL",
    department: "DEPT_MUNICIPAL",
    priority: "HIGH",
    status: "SUBMITTED",
    officialStatus: "RECEIVED",
    createdAt: "2026-10-13T06:00:00.000Z",
    updatedAt: "2026-10-13T06:00:00.000Z",
    lastUpdated: "2026-10-13T06:00:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["market_waste_overflow_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-13T06:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Sanitation failure reported by traders association" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00131",
    referenceNumber: "CS-2026-0031",
    title: "Choked Roadside Stormwater Silt Trap Causing Waterlogging",
    description: "Construction mud washed into open roadside drainage conduit. Even minor rain creates a 2-foot water pool across both traffic lanes.",
    text: "Construction mud washed into open roadside drainage conduit. Even minor rain creates a 2-foot water pool across both traffic lanes.",
    category: "municipal",
    state: "Maharashtra",
    district: "Pune",
    locality: "Katraj-Kondhwa Bypass Road",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_MUNICIPAL",
    department: "DEPT_MUNICIPAL",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    officialStatus: "DESILTING_ACTIVE",
    createdAt: "2026-10-09T14:00:00.000Z",
    updatedAt: "2026-10-11T11:00:00.000Z",
    lastUpdated: "2026-10-11T11:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["waterlogged_subway_photo_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-09T14:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Drain blockage reported" },
      { timestamp: "2026-10-10T10:00:00.000Z", status: "ASSIGNED", actorType: "OFFICER", remarks: "Assigned to Ward Drainage Department" },
      { timestamp: "2026-10-11T11:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Suction-cum-jetting machine deployed for silt clearance" }
    ],
    officerNotes: [
      { timestamp: "2026-10-11T11:05:00.000Z", note: "12 metric tons of wet silt cleared. Second pass scheduled for tomorrow morning.", officerId: "OFF_MUNICIPAL_01" }
    ]
  },
  {
    id: "CPG-2026-00132",
    referenceNumber: "CS-2026-0032",
    title: "Conversion of Faulty Streetlights to Energy-Efficient LED Luminaires",
    description: "Entire 800-meter residential lane had 6 malfunctioning sodium vapor lights. Municipal electrical wing completed rewiring and installed automated timer-controlled LED streetlights.",
    text: "Entire 800-meter residential lane had 6 malfunctioning sodium vapor lights. Municipal electrical wing completed rewiring and installed automated timer-controlled LED streetlights.",
    category: "municipal",
    state: "Maharashtra",
    district: "Pune",
    locality: "Model Colony, Deep Bungalow Chowk",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_MUNICIPAL",
    department: "DEPT_MUNICIPAL",
    priority: "LOW",
    status: "RESOLVED",
    officialStatus: "ILLUMINATED",
    createdAt: "2026-09-25T17:00:00.000Z",
    updatedAt: "2026-10-07T19:30:00.000Z",
    lastUpdated: "2026-10-07T19:30:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["new_led_lighting_night_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-25T17:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Dark street safety complaint lodged" },
      { timestamp: "2026-10-01T10:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Fixture procurement and cable testing" },
      { timestamp: "2026-10-07T19:30:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "6 new 70W LED fixtures commissioned and lux levels verified" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00133",
    referenceNumber: "CS-2026-0033",
    title: "Chronic Traffic Gridlock from Unauthorized Double Parking and Loading",
    description: "Commercial transport trucks unloading goods during restricted daytime hours block two out of three lanes, causing emergency ambulances to be stuck in tailback.",
    text: "Commercial transport trucks unloading goods during restricted daytime hours block two out of three lanes, causing emergency ambulances to be stuck in tailback.",
    category: "police",
    state: "Maharashtra",
    district: "Pune",
    locality: "Bajirao Road, Near Shanipar Chowk",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POLICE",
    department: "DEPT_POLICE",
    priority: "HIGH",
    status: "UNDER_REVIEW",
    officialStatus: "SURVEILLANCE",
    createdAt: "2026-10-11T12:00:00.000Z",
    updatedAt: "2026-10-12T09:30:00.000Z",
    lastUpdated: "2026-10-12T09:30:00.000Z",
    reassignments: 0,
    citizenReminders: 2,
    evidence: ["traffic_bottleneck_cctv_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-11T12:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Traffic congestion complaint registered" },
      { timestamp: "2026-10-12T09:30:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Traffic division deploying towing crane and enforcement team" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00134",
    referenceNumber: "CS-2026-0034",
    title: "Installation of Pedestrian Crossing Signals and Reflective Thermoplastic Markings",
    description: "High-density pedestrian intersection near educational institutions lacked visible zebra lines. New tactile markings and pedestrian push-button crossing lights installed.",
    text: "High-density pedestrian intersection near educational institutions lacked visible zebra lines. New tactile markings and pedestrian push-button crossing lights installed.",
    category: "police",
    state: "Maharashtra",
    district: "Pune",
    locality: "Karve Road, Nal Stop Junction",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_POLICE",
    department: "DEPT_POLICE",
    priority: "MEDIUM",
    status: "RESOLVED",
    officialStatus: "COMMISSIONED",
    createdAt: "2026-09-18T10:30:00.000Z",
    updatedAt: "2026-10-04T16:00:00.000Z",
    lastUpdated: "2026-10-04T16:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["pedestrian_signals_crossing_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-18T10:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Pedestrian safety complaint lodged" },
      { timestamp: "2026-09-24T11:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Joint inspection by Traffic ACP and PMC Road Dept" },
      { timestamp: "2026-10-04T16:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "Signals integrated with adaptive traffic management system" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00135",
    referenceNumber: "CS-2026-0035",
    title: "Biometric e-PoS Device Scanner Malfunction Denying Essential Foodgrains",
    description: "Elderly cardholders unable to complete fingerprint verification due to optical scanner degradation on e-PoS machine at Fair Price Shop 142. Manual OTP fallback refused by dealer.",
    text: "Elderly cardholders unable to complete fingerprint verification due to optical scanner degradation on e-PoS machine at Fair Price Shop 142. Manual OTP fallback refused by dealer.",
    category: "ration",
    state: "Maharashtra",
    district: "Pune",
    locality: "Yerawada, Shanti Nagar",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_RATION",
    department: "DEPT_RATION",
    priority: "HIGH",
    status: "IN_PROGRESS",
    officialStatus: "DEVICE_INSPECTION",
    createdAt: "2026-10-10T11:00:00.000Z",
    updatedAt: "2026-10-12T13:00:00.000Z",
    lastUpdated: "2026-10-12T13:00:00.000Z",
    reassignments: 0,
    citizenReminders: 2,
    evidence: ["epos_error_slip_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-10T11:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Ration denial grievance submitted" },
      { timestamp: "2026-10-12T13:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Supply inspector issued show-cause notice and dispatched replacement IRIS scanner" }
    ],
    officerNotes: [
      { timestamp: "2026-10-12T13:05:00.000Z", note: "Dealer instructed to disburse rations under offline nominee authorization pending hardware swap.", officerId: "OFF_RATION_01" }
    ]
  },
  {
    id: "CPG-2026-00136",
    referenceNumber: "CS-2026-0036",
    title: "Resolution of Entitled Wheat and Fortified Rice Quota Shortage",
    description: "Beneficiary allocated only 15 kg instead of statutory 25 kg entitlement under Antyodaya Anna Yojana. Stock audit conducted and remaining quota disbursed.",
    text: "Beneficiary allocated only 15 kg instead of statutory 25 kg entitlement under Antyodaya Anna Yojana. Stock audit conducted and remaining quota disbursed.",
    category: "ration",
    state: "Maharashtra",
    district: "Pune",
    locality: "Chinchwad, Mohan Nagar",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_RATION",
    department: "DEPT_RATION",
    priority: "MEDIUM",
    status: "RESOLVED",
    officialStatus: "SUPPLEMENTED",
    createdAt: "2026-09-22T14:30:00.000Z",
    updatedAt: "2026-10-02T16:00:00.000Z",
    lastUpdated: "2026-10-02T16:00:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["ration_receipt_ledger_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-22T14:30:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Quota discrepancy complaint logged" },
      { timestamp: "2026-09-26T10:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Food Distribution Officer audited shop ledger" },
      { timestamp: "2026-10-02T16:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "10 kg balance stock handed over; biometric receipt confirmed" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00137",
    referenceNumber: "CS-2026-0037",
    title: "Urgent Restocking of Anti-Snake Venom Serum at District Civil Hospital Casualty",
    description: "Emergency ward physician informed patient attendant that polyvalent snake venom vials were exhausted in central pharmacy store. Emergency consignment mobilized from state medical corporation.",
    text: "Emergency ward physician informed patient attendant that polyvalent snake venom vials were exhausted in central pharmacy store. Emergency consignment mobilized from state medical corporation.",
    category: "healthcare",
    state: "Maharashtra",
    district: "Pune",
    locality: "Aundh Chest & Civil Hospital Campus",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_HEALTH",
    department: "DEPT_HEALTH",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    officialStatus: "EMERGENCY_DISPATCH",
    createdAt: "2026-10-13T05:00:00.000Z",
    updatedAt: "2026-10-13T08:30:00.000Z",
    lastUpdated: "2026-10-13T08:30:00.000Z",
    reassignments: 0,
    citizenReminders: 0,
    evidence: ["casualty_prescription_stamp_synth.jpg"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-13T05:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Critical drug shortage emergency reported" },
      { timestamp: "2026-10-13T08:30:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Civil Surgeon requisitioned 100 vials under local emergency purchase powers" }
    ],
    officerNotes: [
      { timestamp: "2026-10-13T08:35:00.000Z", note: "30 vials delivered to ICU at 08:20; patient condition stabilized.", officerId: "OFF_HEALTH_01" }
    ]
  },
  {
    id: "CPG-2026-00138",
    referenceNumber: "CS-2026-0038",
    title: "Statutory Deadline Delay in Mutation Entry (Ferfar) for Agricultural Land",
    description: "Application for inheritance mutation submitted 45 days ago with all succession certificates. Talathi has not updated the online Mahabhulekh 7/12 portal within 15-day statutory citizen charter deadline.",
    text: "Application for inheritance mutation submitted 45 days ago with all succession certificates. Talathi has not updated the online Mahabhulekh 7/12 portal within 15-day statutory citizen charter deadline.",
    category: "revenue",
    state: "Maharashtra",
    district: "Pune",
    locality: "Haveli Taluka, Loni Kalbhor",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_REVENUE",
    department: "DEPT_REVENUE",
    priority: "HIGH",
    status: "SUBMITTED",
    officialStatus: "RECEIVED",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    lastUpdated: "2026-09-01T10:00:00.000Z",
    reassignments: 0,
    citizenReminders: 3,
    evidence: ["mutation_application_acknowledgement_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-09-01T10:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Delayed revenue service grievance submitted" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00139",
    referenceNumber: "CS-2026-0039",
    title: "Stipend Disbursal Hold on State DBT Higher Education Scholarship",
    description: "Post-matric scholarship approved by college desk is stuck in pending state at District Social Welfare Officer verification level, threatening student semester examination eligibility.",
    text: "Post-matric scholarship approved by college desk is stuck in pending state at District Social Welfare Officer verification level, threatening student semester examination eligibility.",
    category: "scholarship",
    state: "Maharashtra",
    district: "Pune",
    locality: "Shivajinagar, College of Engineering Pune Campus",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_SCHOLARSHIP",
    department: "DEPT_SCHOLARSHIP",
    priority: "MEDIUM",
    status: "UNDER_REVIEW",
    officialStatus: "SCRUTINY",
    createdAt: "2026-10-06T14:00:00.000Z",
    updatedAt: "2026-10-08T11:00:00.000Z",
    lastUpdated: "2026-10-08T11:00:00.000Z",
    reassignments: 0,
    citizenReminders: 1,
    evidence: ["scholarship_application_portal_screengrab_synth.png"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-10-06T14:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Scholarship disbursement grievance registered" },
      { timestamp: "2026-10-08T11:00:00.000Z", status: "UNDER_REVIEW", actorType: "OFFICER", remarks: "Nodal officer cross-checking PFMS payment batch batch ID" }
    ],
    officerNotes: []
  },
  {
    id: "CPG-2026-00140",
    referenceNumber: "CS-2026-0040",
    title: "Reconciliation and Payment of Ex-Gratia Flood Rehabilitation Relief",
    description: "River flood inundation caused house damage during August monsoon. Relief survey was completed but DBT transfer bounced due to IFSC code migration. Direct account correction processed.",
    text: "River flood inundation caused house damage during August monsoon. Relief survey was completed but DBT transfer bounced due to IFSC code migration. Direct account correction processed.",
    category: "flood relief",
    state: "Maharashtra",
    district: "Pune",
    locality: "Sangvi, Mula River Bank",
    preferredLanguage: "en",
    language: "en",
    departmentId: "DEPT_DISASTER",
    department: "DEPT_DISASTER",
    priority: "HIGH",
    status: "CLOSED",
    officialStatus: "DISBURSED",
    createdAt: "2026-08-25T11:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    lastUpdated: "2026-10-02T10:00:00.000Z",
    reassignments: 0,
    citizenReminders: 2,
    evidence: ["flood_relief_sanction_voucher_synth.pdf"],
    synthetic: true,
    statusHistory: [
      { timestamp: "2026-08-25T11:00:00.000Z", status: "SUBMITTED", actorType: "CITIZEN", remarks: "Flood assistance payment grievance lodged" },
      { timestamp: "2026-09-15T12:00:00.000Z", status: "IN_PROGRESS", actorType: "OFFICER", remarks: "Treasury mandate updated with active Aadhaar mapped bank account" },
      { timestamp: "2026-10-01T15:00:00.000Z", status: "RESOLVED", actorType: "OFFICER", remarks: "INR 50,000 ex-gratia successfully credited via PFMS transaction ref TR-2026-7819" },
      { timestamp: "2026-10-02T10:00:00.000Z", status: "CLOSED", actorType: "OFFICER", remarks: "Ex-gratia relief case formally closed after citizen acknowledgment." }
    ],
    officerNotes: [
      { timestamp: "2026-10-01T15:05:00.000Z", note: "Bank confirmation UTR verified by Tahsildar Disaster Management cell.", officerId: "OFF_DISASTER_01" }
    ]
  }
];

export async function runSeed(options = {}) {
  const isReset = options.reset || process.argv.includes('--reset') || process.argv.includes('--force');
  const targetDir = options.dataDir || process.env.DATA_DIR || DATA_DIR;

  // Ensure data dir exists
  await fs.mkdir(targetDir, { recursive: true });

  const deptFile = path.join(targetDir, 'departments.json');
  const compFile = path.join(targetDir, 'complaints.json');
  const histFile = path.join(targetDir, 'status_history.json');

  if (isReset) {
    console.log('[CivicSarthi Seed] NOTICE: Deliberate demo-data reset mode active (--reset/--force). Restoring clean synthetic demonstration fixtures.');
  } else {
    console.log('[CivicSarthi Seed] NOTICE: Ordinary seed mode active. Preserving genuine user-created records.');
  }

  // 1. Write Departments
  const deptData = {
    metadata: {
      synthetic: true,
      version: "1.1.0",
      description: "Synthetic demonstration department directory for CivicSarthi platform"
    },
    departments: SEED_DEPARTMENTS
  };
  await fs.writeFile(deptFile, JSON.stringify(deptData, null, 2), 'utf-8');
  console.log(`[CivicSarthi Seed] Wrote ${SEED_DEPARTMENTS.length} departments to ${deptFile}`);

  // 2. Determine Complaints to write
  let preservedUserComplaints = [];
  let preservedUserHistory = [];
  const existingMap = new Map();

  if (!isReset) {
    try {
      const rawComp = await fs.readFile(compFile, 'utf-8');
      const existingComp = JSON.parse(rawComp);
      if (Array.isArray(existingComp.complaints)) {
        for (const c of existingComp.complaints) {
          if (c.referenceNumber) existingMap.set(c.referenceNumber, c);
        }
        preservedUserComplaints = existingComp.complaints.filter(c =>
          c.synthetic === false ||
          (c.synthetic !== true && !SEED_COMPLAINTS.some(s => s.id === c.id || s.referenceNumber === c.referenceNumber))
        );
      }
    } catch {
      // File does not exist yet
    }

    try {
      const rawHist = await fs.readFile(histFile, 'utf-8');
      const existingHist = JSON.parse(rawHist);
      if (Array.isArray(existingHist.history) && preservedUserComplaints.length > 0) {
        const userRefIds = new Set(preservedUserComplaints.map(c => c.id || c.referenceNumber));
        preservedUserHistory = existingHist.history.filter(h => userRefIds.has(h.complaintId) || userRefIds.has(h.referenceNumber));
      }
    } catch {
      // History file does not exist yet
    }
  }

  // Combine: preserved genuine complaints first, then standard synthetic seed complaints (preserving any prior demo citizen assignment)
  const finalComplaints = [
    ...preservedUserComplaints,
    ...SEED_COMPLAINTS.map(c => {
      const existing = existingMap.get(c.referenceNumber);
      return {
        ...c,
        citizenId: existing?.citizenId || c.citizenId || (c.synthetic ? 'SYNTHETIC_CPGRAMS_DEMO' : 'UNCLAIMED_RECORD'),
        citizenName: existing?.citizenName || c.citizenName || undefined,
        citizenEmail: existing?.citizenEmail || c.citizenEmail || undefined
      };
    })
  ];
  const compData = {
    metadata: {
      synthetic: preservedUserComplaints.length === 0,
      total: finalComplaints.length,
      userRecordsCount: preservedUserComplaints.length,
      demoRecordsCount: SEED_COMPLAINTS.length,
      version: "1.1.0",
      description: "CivicSarthi complaints repository"
    },
    complaints: finalComplaints
  };
  await fs.writeFile(compFile, JSON.stringify(compData, null, 2), 'utf-8');
  console.log(`[CivicSarthi Seed] Wrote ${finalComplaints.length} complaints to ${compFile} (Preserved ${preservedUserComplaints.length} user-created records)`);

  // 3. Write Status History
  const seedHistoryRecords = [];
  let histId = 1;
  for (const c of SEED_COMPLAINTS) {
    if (Array.isArray(c.statusHistory)) {
      for (const h of c.statusHistory) {
        seedHistoryRecords.push({
          id: `HIST-${String(histId++).padStart(3, '0')}`,
          complaintId: c.id,
          referenceNumber: c.referenceNumber,
          timestamp: h.timestamp,
          status: h.status,
          actorType: h.actorType,
          remarks: h.remarks
        });
      }
    }
  }

  const finalHistory = [...preservedUserHistory, ...seedHistoryRecords];
  const histData = {
    metadata: {
      synthetic: preservedUserHistory.length === 0,
      version: "1.1.0",
      description: "Timeline and status history audit trail for CivicSarthi complaints"
    },
    history: finalHistory
  };
  await fs.writeFile(histFile, JSON.stringify(histData, null, 2), 'utf-8');
  console.log(`[CivicSarthi Seed] Wrote ${finalHistory.length} history records to ${histFile} (Preserved ${preservedUserHistory.length} user history records)`);

  console.log('[CivicSarthi Seed] Successfully finished seeding process.');
  return {
    departmentsCount: SEED_DEPARTMENTS.length,
    complaintsCount: finalComplaints.length,
    userRecordsPreserved: preservedUserComplaints.length
  };
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed().catch(err => {
    console.error('[CivicSarthi Seed Error]', err);
    process.exit(1);
  });
}
