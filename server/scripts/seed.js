#!/usr/bin/env node
/*
 * server/scripts/seed.js
 * -----------------------------------------------------------------------
 * Populates MongoDB with realistic pitch-demo data for GigInsure.
 *
 * Creates:
 *   - 15 workers  (all password: "demo123")
 *   - 12 policies (8 basic / 3 standard / 1 premium; 10 active / 2 expired)
 *   - 28 trigger logs spread over the last 30 days
 *   - 20 claims   (8 paid AUTO_APPROVE, 4 approved, 3 flagged, 2 rejected, 3 pending)
 *   - 15 payments (12 premium + 3 payout)
 *
 * Usage:
 *   node server/scripts/seed.js           (asks for confirmation)
 *   node server/scripts/seed.js --force   (skips confirmation)
 * -----------------------------------------------------------------------
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const readline = require('readline');

const Worker     = require('../models/Worker');
const Policy     = require('../models/Policy');
const Claim      = require('../models/Claim');
const TriggerLog = require('../models/TriggerLog');
const Payment    = require('../models/Payment');

// -----------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------
const daysAgo  = (n) => new Date(Date.now() - n * 864e5);
const daysFrom = (n) => new Date(Date.now() + n * 864e5);

// -----------------------------------------------------------------------
// Worker definitions  (15 workers)
// -----------------------------------------------------------------------
const WORKERS_DEF = [
  // idx  name               phone        platform    pincode  city         vehicle        dailyIncome  riskScore  tenure
  { name: 'Ramesh Kumar',  phone: '9876501001', platform: 'swiggy',  pincode: 201301, city: 'Noida',     vehicle: 'motorcycle', dailyIncome: 800,  zoneRiskScore: 65, tenureDays: 180 },
  { name: 'Priya Sharma',  phone: '9876501002', platform: 'zomato',  pincode: 110001, city: 'Delhi',     vehicle: 'cycle',      dailyIncome: 650,  zoneRiskScore: 72, tenureDays: 90  },
  { name: 'Suresh Reddy',  phone: '9876501003', platform: 'rapido',  pincode: 122001, city: 'Gurugram',  vehicle: 'motorcycle', dailyIncome: 750,  zoneRiskScore: 58, tenureDays: 210 },
  { name: 'Anita Patel',   phone: '9876501004', platform: 'blinkit', pincode: 201302, city: 'Noida',     vehicle: 'cycle',      dailyIncome: 600,  zoneRiskScore: 63, tenureDays: 45  },
  { name: 'Mohan Singh',   phone: '9876501005', platform: 'swiggy',  pincode: 110002, city: 'Delhi',     vehicle: 'motorcycle', dailyIncome: 900,  zoneRiskScore: 75, tenureDays: 320 },
  { name: 'Kavita Verma',  phone: '9876501006', platform: 'zomato',  pincode: 560001, city: 'Bangalore', vehicle: 'cycle',      dailyIncome: 700,  zoneRiskScore: 48, tenureDays: 150 },
  { name: 'Deepak Yadav',  phone: '9876501007', platform: 'dunzo',   pincode: 400001, city: 'Mumbai',    vehicle: 'motorcycle', dailyIncome: 1100, zoneRiskScore: 55, tenureDays: 95  },
  { name: 'Sunita Kumari', phone: '9876501008', platform: 'rapido',  pincode: 201301, city: 'Noida',     vehicle: 'bicycle',    dailyIncome: 550,  zoneRiskScore: 65, tenureDays: 30  },
  { name: 'Ravi Nair',     phone: '9876501009', platform: 'swiggy',  pincode: 600001, city: 'Chennai',   vehicle: 'motorcycle', dailyIncome: 850,  zoneRiskScore: 42, tenureDays: 270 },
  { name: 'Geeta Mishra',  phone: '9876501010', platform: 'zomato',  pincode: 700001, city: 'Kolkata',   vehicle: 'cycle',      dailyIncome: 620,  zoneRiskScore: 60, tenureDays: 120 },
  { name: 'Ajay Mehta',    phone: '9876501011', platform: 'blinkit', pincode: 110001, city: 'Delhi',     vehicle: 'motorcycle', dailyIncome: 950,  zoneRiskScore: 72, tenureDays: 200 },
  { name: 'Lakshmi Devi',  phone: '9876501012', platform: 'zepto',   pincode: 560001, city: 'Bangalore', vehicle: 'bicycle',    dailyIncome: 580,  zoneRiskScore: 48, tenureDays: 75  },
  { name: 'Vinod Kumar',   phone: '9876501013', platform: 'swiggy',  pincode: 122001, city: 'Gurugram',  vehicle: 'motorcycle', dailyIncome: 870,  zoneRiskScore: 58, tenureDays: 365 },
  { name: 'Pooja Sharma',  phone: '9876501014', platform: 'rapido',  pincode: 201303, city: 'Noida',     vehicle: 'motorcycle', dailyIncome: 720,  zoneRiskScore: 62, tenureDays: 15  },
  { name: 'Pooja Mishra',  phone: '9876501015', platform: 'zomato',  pincode: 110001, city: 'Delhi',     vehicle: 'cycle',      dailyIncome: 680,  zoneRiskScore: 72, tenureDays: 60  },
];

// -----------------------------------------------------------------------
// Plan definitions
// -----------------------------------------------------------------------
const PLANS = {
  basic:    { premiumPaid: 49,  coverageCap: 500,  maxHours: 10 },
  standard: { premiumPaid: 89,  coverageCap: 900,  maxHours: 18 },
  premium:  { premiumPaid: 149, coverageCap: 1400, maxHours: 28 },
};

// Policy map: [workerIdx, planName, status]
// 8 basic (idx 0,1,3,5,7,9,10,11) · 3 standard (2,4,8) · 1 premium (6) = 12 total
// 10 active (0-9) · 2 expired (10,11)
const POLICY_MAP = [
  [0,  'basic',    'active'],
  [1,  'basic',    'active'],
  [2,  'standard', 'active'],
  [3,  'basic',    'active'],
  [4,  'standard', 'active'],
  [5,  'basic',    'active'],
  [6,  'premium',  'active'],
  [7,  'basic',    'active'],
  [8,  'standard', 'active'],
  [9,  'basic',    'active'],
  [10, 'basic',    'expired'],
  [11, 'basic',    'expired'],
];

// -----------------------------------------------------------------------
// Trigger log definitions  (28 entries)
// [pincode, triggerType, value, threshold, fired, source, daysBack]
// -----------------------------------------------------------------------
const TRIGGER_LOGS_DEF = [
  // ── ACTIVE NOW (detectedAt within last hour) ─ 4 entries ──────────────
  ['201301', 'heavy_rain',     22.4, 15,  true,  'openweathermap', 0.01 ],  // ~14 min ago
  ['110001', 'heavy_rain',     25.7, 15,  true,  'openweathermap', 0.02 ],  // ~29 min ago
  ['110001', 'extreme_heat',   45.2, 43,  true,  'openweathermap', 0.02 ],  // ~29 min ago
  ['201301', 'dangerous_aqi',  372,  350, true,  'openweathermap', 0.03 ],  // ~43 min ago
  // ── ELEVATED (2–6 hours ago, resolved) ────────────────────────────────
  ['201301', 'heavy_rain',     18.1, 15,  true,  'openweathermap', 0.15 ],  // ~3.6 hrs ago
  ['110002', 'heavy_rain',     17.3, 15,  true,  'openweathermap', 0.18 ],  // ~4.3 hrs ago
  ['122001', 'heavy_rain',     19.8, 15,  true,  'openweathermap', 0.22 ],  // ~5.3 hrs ago
  // ── Historical fired (older) ───────────────────────────────────────────
  ['110002', 'extreme_heat',   46.1, 43,  true,  'openweathermap', 5   ],
  ['122001', 'extreme_heat',   44.0, 43,  true,  'openweathermap', 8   ],
  ['201303', 'extreme_heat',   43.8, 43,  true,  'openweathermap', 15  ],
  // dangerous_aqi (historical)
  ['110001', 'dangerous_aqi',  368,  350, true,  'openweathermap', 10  ],
  ['110002', 'dangerous_aqi',  355,  350, true,  'openweathermap', 18  ],
  // platform_outage (fired)
  ['201301', 'platform_outage',  1,  1,   true,  'manual',         6   ],
  ['560001', 'platform_outage',  1,  1,   true,  'manual',         11  ],
  ['400001', 'platform_outage',  1,  1,   true,  'manual',         20  ],
  // curfew (fired)
  ['110001', 'curfew',           1,  1,   true,  'newsapi',        9   ],
  ['110002', 'curfew',           1,  1,   true,  'newsapi',        16  ],
  ['201301', 'curfew',           1,  1,   true,  'newsapi',        22  ],
  // flood (fired)
  ['201301', 'flood',            1,  1,   true,  'newsapi',        14  ],
  ['201302', 'flood',            1,  1,   true,  'newsapi',        25  ],
  // cyclone — below threshold, did NOT fire
  ['600001', 'cyclone',        0.3,  1,   false, 'newsapi',        13  ],
  ['700001', 'cyclone',        0.2,  1,   false, 'newsapi',        28  ],
  // below-threshold checks (fired=false)
  ['201301', 'heavy_rain',      9.2, 15,  false, 'openweathermap', 17  ],
  ['122001', 'extreme_heat',   41.5, 43,  false, 'openweathermap', 19  ],
  ['560001', 'heavy_rain',      7.8, 15,  false, 'openweathermap', 21  ],
  ['400001', 'extreme_heat',   40.1, 43,  false, 'openweathermap', 23  ],
  ['700001', 'dangerous_aqi',  280,  350, false, 'openweathermap', 24  ],
  ['600001', 'heavy_rain',     11.3, 15,  false, 'openweathermap', 26  ],
];

// -----------------------------------------------------------------------
// GPS coordinate lookup by pincode string
// -----------------------------------------------------------------------
const PINCODE_COORDS = {
  '201301': { lat: 28.5706, lng: 77.3219 },
  '201302': { lat: 28.5459, lng: 77.3393 },
  '201303': { lat: 28.5706, lng: 77.3219 },
  '110001': { lat: 28.6329, lng: 77.2195 },
  '110002': { lat: 28.6449, lng: 77.2310 },
  '122001': { lat: 28.4595, lng: 77.0266 },
  '400001': { lat: 18.9388, lng: 72.8354 },
  '560001': { lat: 12.9716, lng: 77.5946 },
  '600001': { lat: 13.0827, lng: 80.2707 },
  '700001': { lat: 22.5726, lng: 88.3639 },
};

// -----------------------------------------------------------------------
// Claim definitions  (20 entries)
// Payout amounts are pre-computed: floor(dailyIncome / 8 * sessionMinutes/60)
// -----------------------------------------------------------------------
const CLAIMS_DEF = [
  // ── AUTO_APPROVE · status=paid (8) ──────────────────────────────────
  { wIdx: 0, triggerType: 'heavy_rain',      triggerValue: 22.4, fraudScore: 0.12, decision: 'AUTO_APPROVE', payoutAmount: 100, status: 'paid',         daysBack: 0.5, gpsVerified: true,  sessionMinutes: 60  },
  { wIdx: 1, triggerType: 'heavy_rain',      triggerValue: 25.7, fraudScore: 0.18, decision: 'AUTO_APPROVE', payoutAmount: 81,  status: 'paid',         daysBack: 2,   gpsVerified: true,  sessionMinutes: 75  },
  { wIdx: 4, triggerType: 'extreme_heat',    triggerValue: 46.1, fraudScore: 0.09, decision: 'AUTO_APPROVE', payoutAmount: 113, status: 'paid',         daysBack: 5,   gpsVerified: true,  sessionMinutes: 90  },
  { wIdx: 2, triggerType: 'heavy_rain',      triggerValue: 19.8, fraudScore: 0.15, decision: 'AUTO_APPROVE', payoutAmount: 94,  status: 'paid',         daysBack: 12,  gpsVerified: true,  sessionMinutes: 60  },
  { wIdx: 6, triggerType: 'platform_outage', triggerValue: 1,    fraudScore: 0.08, decision: 'AUTO_APPROVE', payoutAmount: 138, status: 'paid',         daysBack: 20,  gpsVerified: true,  sessionMinutes: 120 },
  { wIdx: 5, triggerType: 'platform_outage', triggerValue: 1,    fraudScore: 0.21, decision: 'AUTO_APPROVE', payoutAmount: 88,  status: 'paid',         daysBack: 11,  gpsVerified: true,  sessionMinutes: 90  },
  { wIdx: 8, triggerType: 'extreme_heat',    triggerValue: 44.0, fraudScore: 0.14, decision: 'AUTO_APPROVE', payoutAmount: 106, status: 'paid',         daysBack: 8,   gpsVerified: true,  sessionMinutes: 75  },
  { wIdx: 3, triggerType: 'dangerous_aqi',   triggerValue: 372,  fraudScore: 0.17, decision: 'AUTO_APPROVE', payoutAmount: 75,  status: 'paid',         daysBack: 4,   gpsVerified: true,  sessionMinutes: 60  },
  // ── AUTO_APPROVE · status=approved (4) ──────────────────────────────
  { wIdx: 0, triggerType: 'dangerous_aqi',   triggerValue: 368,  fraudScore: 0.22, decision: 'AUTO_APPROVE', payoutAmount: 100, status: 'approved',     daysBack: 1,   gpsVerified: true,  sessionMinutes: 60  },
  { wIdx: 9, triggerType: 'extreme_heat',    triggerValue: 45.2, fraudScore: 0.11, decision: 'AUTO_APPROVE', payoutAmount: 78,  status: 'approved',     daysBack: 1,   gpsVerified: true,  sessionMinutes: 60  },
  { wIdx: 7, triggerType: 'curfew',          triggerValue: 1,    fraudScore: 0.19, decision: 'AUTO_APPROVE', payoutAmount: 69,  status: 'approved',     daysBack: 9,   gpsVerified: true,  sessionMinutes: 90  },
  { wIdx: 4, triggerType: 'curfew',          triggerValue: 1,    fraudScore: 0.25, decision: 'AUTO_APPROVE', payoutAmount: 113, status: 'approved',     daysBack: 16,  gpsVerified: true,  sessionMinutes: 75  },
  // ── Flagged: SOFT_HOLD + MANUAL_REVIEW (3) ──────────────────────────
  { wIdx: 1, triggerType: 'extreme_heat',    triggerValue: 43.8, fraudScore: 0.52, decision: 'SOFT_HOLD',    payoutAmount: 0,   status: 'pending',      daysBack: 15,  gpsVerified: false, sessionMinutes: 45  },
  { wIdx: 0, triggerType: 'curfew',          triggerValue: 1,    fraudScore: 0.71, decision: 'MANUAL_REVIEW',payoutAmount: 0,   status: 'under_review', daysBack: 22,  gpsVerified: true,  sessionMinutes: 5   },
  { wIdx: 5, triggerType: 'heavy_rain',      triggerValue: 17.3, fraudScore: 0.68, decision: 'MANUAL_REVIEW',payoutAmount: 0,   status: 'under_review', daysBack: 7,   gpsVerified: false, sessionMinutes: 30  },
  // ── AUTO_REJECT (2) ─────────────────────────────────────────────────
  { wIdx: 2, triggerType: 'dangerous_aqi',   triggerValue: 355,  fraudScore: 0.91, decision: 'AUTO_REJECT',  payoutAmount: 0,   status: 'rejected',     daysBack: 18,  gpsVerified: false, sessionMinutes: 2   },
  { wIdx: 3, triggerType: 'flood',           triggerValue: 1,    fraudScore: 0.88, decision: 'AUTO_REJECT',  payoutAmount: 0,   status: 'rejected',     daysBack: 25,  gpsVerified: false, sessionMinutes: 1   },
  // ── Pending / soft-hold (3) ─────────────────────────────────────────
  { wIdx: 6, triggerType: 'flood',           triggerValue: 1,    fraudScore: 0.44, decision: 'SOFT_HOLD',    payoutAmount: 0,   status: 'pending',      daysBack: 14,  gpsVerified: true,  sessionMinutes: 60  },
  { wIdx: 8, triggerType: 'platform_outage', triggerValue: 1,    fraudScore: 0.38, decision: 'SOFT_HOLD',    payoutAmount: 0,   status: 'pending',      daysBack: 6,   gpsVerified: true,  sessionMinutes: 45  },
  { wIdx: 9, triggerType: 'curfew',          triggerValue: 1,    fraudScore: 0.29, decision: 'AUTO_APPROVE', payoutAmount: 0,   status: 'pending',      daysBack: 3,   gpsVerified: true,  sessionMinutes: 60  },
];

// -----------------------------------------------------------------------
// Prompt helper (used when --force is not passed)
// -----------------------------------------------------------------------
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// -----------------------------------------------------------------------
// Main seed function
// -----------------------------------------------------------------------
async function seed() {
  const force = process.argv.includes('--force');

  // Connect
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/giginsure';
  console.log(`\nConnecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  console.log('Connected.\n');

  // Confirmation gate
  if (!force) {
    const answer = await askConfirmation(
      'WARNING: This will DELETE all existing workers, policies, claims,\n' +
      'trigger logs, and payments, then insert fresh seed data.\n\n' +
      'Type "yes" to continue: '
    );
    if (answer !== 'yes') {
      console.log('Aborted.');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  // ── Step 1: Clear existing data ──────────────────────────────────────
  console.log('Clearing existing data...');
  await Promise.all([
    Worker.deleteMany({}),
    Policy.deleteMany({}),
    Claim.deleteMany({}),
    TriggerLog.deleteMany({}),
    Payment.deleteMany({}),
  ]);
  console.log('  Cleared: workers, policies, claims, trigger_logs, payments\n');

  // ── Step 2: Hash password (shared by all demo workers) ───────────────
  const passwordHash = await bcrypt.hash('demo123', 10);

  // ── Step 3: Create workers ────────────────────────────────────────────
  console.log('Creating 15 workers...');
  const workers = await Worker.insertMany(
    WORKERS_DEF.map((def) => ({ ...def, passwordHash }))
  );
  console.log(`  Created ${workers.length} workers\n`);

  // ── Step 4: Create policies ───────────────────────────────────────────
  console.log('Creating 12 policies...');
  const policyDocs = [];
  for (const [wIdx, planName, status] of POLICY_MAP) {
    const worker = workers[wIdx];
    const plan   = PLANS[planName];
    const isActive  = status === 'active';
    const startDate = isActive ? daysAgo(7)  : daysAgo(40);
    const endDate   = isActive ? daysFrom(23): daysAgo(10);

    const policy = await Policy.create({
      workerId:    worker._id,
      plan:        planName,
      premiumPaid: plan.premiumPaid,
      coverageCap: plan.coverageCap,
      maxHours:    plan.maxHours,
      startDate,
      endDate,
      status,
    });
    policyDocs.push({ wIdx, policy, planName, status });
  }
  console.log(`  Created ${policyDocs.length} policies\n`);

  // Build workerId → active policy map for claims
  const activePolicyByWIdx = {};
  for (const { wIdx, policy, status } of policyDocs) {
    if (status === 'active') activePolicyByWIdx[wIdx] = policy;
  }

  // Update workers with their activePolicyId
  for (const [wIdx, policy] of Object.entries(activePolicyByWIdx)) {
    await Worker.findByIdAndUpdate(workers[Number(wIdx)]._id, { activePolicyId: policy._id });
  }
  console.log('  Linked activePolicyId on workers\n');

  // ── Step 5: Create trigger logs ───────────────────────────────────────
  console.log('Creating 28 trigger logs...');
  const triggerDocs = await TriggerLog.insertMany(
    TRIGGER_LOGS_DEF.map(([pincode, triggerType, value, threshold, fired, source, daysBack]) => ({
      pincode,
      triggerType,
      value,
      threshold,
      fired,
      source,
      detectedAt: daysAgo(daysBack),
    }))
  );
  console.log(`  Created ${triggerDocs.length} trigger logs\n`);

  // ── Step 6: Create claims ─────────────────────────────────────────────
  console.log('Creating 20 claims...');
  const claimDocs = [];
  for (const def of CLAIMS_DEF) {
    const worker = workers[def.wIdx];
    const policy = activePolicyByWIdx[def.wIdx];
    if (!policy) {
      console.warn(`  SKIP: worker[${def.wIdx}] (${worker.name}) has no active policy`);
      continue;
    }

    const coords     = PINCODE_COORDS[String(worker.pincode)] || { lat: 28.6139, lng: 77.2090 };
    const initiatedAt = daysAgo(def.daysBack);
    const isResolved  = ['paid', 'approved', 'rejected'].includes(def.status);

    const claim = await Claim.create({
      policyId:       policy._id,
      workerId:       worker._id,
      triggerType:    def.triggerType,
      triggerValue:   def.triggerValue,
      fraudScore:     def.fraudScore,
      decision:       def.decision,
      payoutAmount:   def.payoutAmount,
      status:         def.status,
      gpsLat:         coords.lat,
      gpsLng:         coords.lng,
      gpsVerified:    def.gpsVerified,
      sessionMinutes: def.sessionMinutes,
      deviceFlag:     false,
      initiatedAt,
      resolvedAt: isResolved ? initiatedAt : null,
    });
    claimDocs.push({ def, claim, worker, policy });
  }
  console.log(`  Created ${claimDocs.length} claims\n`);

  // ── Step 7: Create payments ───────────────────────────────────────────
  console.log('Creating 15 payments...');
  let paymentCount = 0;

  // 12 premium payments — one per policy
  for (const { wIdx, policy, planName } of policyDocs) {
    const worker = workers[wIdx];
    const plan   = PLANS[planName];
    await Payment.create({
      workerId:      worker._id,
      referenceId:   policy._id,
      paymentType:   'premium',
      amount:        plan.premiumPaid,
      upiId:         `${worker.name.split(' ')[0].toLowerCase()}@upi`,
      transactionId: `seed_prem_${policy._id}`,
      orderId:       `seed_ord_${policy._id}`,
      status:        'completed',
      gateway:       'mock',
      settledAt:     policy.startDate,
    });
    paymentCount++;
  }

  // 3 payout payments — for the first 3 "paid" claims
  const paidClaims = claimDocs.filter((c) => c.def.status === 'paid').slice(0, 3);
  for (const { claim, worker } of paidClaims) {
    await Payment.create({
      workerId:      worker._id,
      referenceId:   claim._id,
      paymentType:   'payout',
      amount:        claim.payoutAmount,
      upiId:         `${worker.name.split(' ')[0].toLowerCase()}@upi`,
      transactionId: `seed_pout_${claim._id}`,
      status:        'completed',
      gateway:       'mock',
      settledAt:     claim.initiatedAt,
    });
    paymentCount++;
  }
  console.log(`  Created ${paymentCount} payments\n`);

  // ── Step 8: Summary ───────────────────────────────────────────────────
  const [wCount, pCount, clCount, tCount, pmCount] = await Promise.all([
    Worker.countDocuments(),
    Policy.countDocuments(),
    Claim.countDocuments(),
    TriggerLog.countDocuments(),
    Payment.countDocuments(),
  ]);

  const autoApprove = claimDocs.filter((c) => c.def.decision === 'AUTO_APPROVE').length;
  const flagged     = claimDocs.filter((c) => ['SOFT_HOLD', 'MANUAL_REVIEW'].includes(c.def.decision)).length;
  const rejected    = claimDocs.filter((c) => c.def.decision === 'AUTO_REJECT').length;
  const totalPayout = claimDocs.filter((c) => c.def.status === 'paid').reduce((s, c) => s + c.claim.payoutAmount, 0);

  console.log('='.repeat(52));
  console.log('  GigInsure Seed Summary');
  console.log('='.repeat(52));
  console.log(`  Workers       : ${wCount}  (all password: demo123)`);
  console.log(`  Policies      : ${pCount}  (8 basic · 3 standard · 1 premium)`);
  console.log(`    Active      : ${policyDocs.filter((p) => p.status === 'active').length}`);
  console.log(`    Expired     : ${policyDocs.filter((p) => p.status === 'expired').length}`);
  console.log(`  Trigger Logs  : ${tCount}  (fired: ${triggerDocs.filter((t) => t.fired).length} · below-threshold: ${triggerDocs.filter((t) => !t.fired).length})`);
  console.log(`  Claims        : ${clCount}`);
  console.log(`    AUTO_APPROVE: ${autoApprove}  (8 paid · 4 approved)`);
  console.log(`    Flagged     : ${flagged}  (SOFT_HOLD / MANUAL_REVIEW)`);
  console.log(`    AUTO_REJECT : ${rejected}`);
  console.log(`  Payments      : ${pmCount}  (12 premium · 3 payout)`);
  console.log(`  Total Payout  : Rs.${totalPayout}  (paid claims)`);
  console.log('='.repeat(52));
  console.log('\n  Login with any worker phone + password "demo123"\n');

  // Print worker phone list for convenience
  console.log('  Sample worker logins:');
  workers.slice(0, 5).forEach((w) => {
    console.log(`    ${w.phone}  /  demo123  →  ${w.name}`);
  });
  console.log('  ...\n');

  await mongoose.disconnect();
  console.log('Done. MongoDB disconnected.\n');
}

// -----------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------
seed().catch((err) => {
  console.error('\nSeed failed:', err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
