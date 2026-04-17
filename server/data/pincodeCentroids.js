/*
 * server/data/pincodeCentroids.js
 * -----------------------------------------------------------------------
 * Geographic centroid coordinates and metadata for the Indian pincodes
 * that GigInsure actively covers.
 *
 * Used by:
 *   - server/routes/eligibility.js  (bulk zone data for the frontend map)
 *   - server/routes/demo.js         (GPS coords for demo mode)
 *   - server/services/fraudService  (GPS zone-match verification)
 *
 * Fields per entry:
 *   pincode   — 6-digit string
 *   lat/lon   — geographic centroid (WGS84)
 *   city      — display city name
 *   state     — Indian state/UT
 *   tier      — city tier (1/2/3) — affects risk multiplier
 *   covered   — whether GigInsure actively offers policies here
 * -----------------------------------------------------------------------
 */

module.exports = [
  // ── NCR / Delhi ─────────────────────────────────────────────────────
  { pincode: '201301', lat: 28.5706, lon: 77.3219, city: 'Noida',     state: 'Uttar Pradesh', tier: 1, covered: true },
  { pincode: '201302', lat: 28.5459, lon: 77.3393, city: 'Noida',     state: 'Uttar Pradesh', tier: 1, covered: true },
  { pincode: '201303', lat: 28.5620, lon: 77.3300, city: 'Noida',     state: 'Uttar Pradesh', tier: 1, covered: true },
  { pincode: '110001', lat: 28.6329, lon: 77.2195, city: 'Delhi',     state: 'Delhi',         tier: 1, covered: true },
  { pincode: '110002', lat: 28.6449, lon: 77.2310, city: 'Delhi',     state: 'Delhi',         tier: 1, covered: true },
  { pincode: '110011', lat: 28.5860, lon: 77.2420, city: 'Delhi',     state: 'Delhi',         tier: 1, covered: true },
  { pincode: '110015', lat: 28.6430, lon: 77.1200, city: 'Delhi',     state: 'Delhi',         tier: 1, covered: true },
  { pincode: '122001', lat: 28.4595, lon: 77.0266, city: 'Gurugram',  state: 'Haryana',       tier: 1, covered: true },
  { pincode: '122018', lat: 28.4226, lon: 77.0440, city: 'Gurugram',  state: 'Haryana',       tier: 1, covered: true },

  // ── Mumbai ──────────────────────────────────────────────────────────
  { pincode: '400001', lat: 18.9388, lon: 72.8354, city: 'Mumbai',    state: 'Maharashtra',   tier: 1, covered: true },
  { pincode: '400012', lat: 18.9750, lon: 72.8258, city: 'Mumbai',    state: 'Maharashtra',   tier: 1, covered: true },
  { pincode: '400051', lat: 19.0548, lon: 72.8259, city: 'Mumbai',    state: 'Maharashtra',   tier: 1, covered: true },
  { pincode: '400070', lat: 19.0820, lon: 72.8990, city: 'Mumbai',    state: 'Maharashtra',   tier: 1, covered: true },

  // ── Bangalore ───────────────────────────────────────────────────────
  { pincode: '560001', lat: 12.9716, lon: 77.5946, city: 'Bangalore', state: 'Karnataka',     tier: 1, covered: true },
  { pincode: '560034', lat: 12.9352, lon: 77.6245, city: 'Bangalore', state: 'Karnataka',     tier: 1, covered: true },
  { pincode: '560068', lat: 12.9005, lon: 77.6460, city: 'Bangalore', state: 'Karnataka',     tier: 1, covered: true },

  // ── Chennai ──────────────────────────────────────────────────────────
  { pincode: '600001', lat: 13.0827, lon: 80.2707, city: 'Chennai',   state: 'Tamil Nadu',    tier: 1, covered: true },
  { pincode: '600028', lat: 13.0604, lon: 80.2496, city: 'Chennai',   state: 'Tamil Nadu',    tier: 1, covered: true },

  // ── Kolkata ──────────────────────────────────────────────────────────
  { pincode: '700001', lat: 22.5726, lon: 88.3639, city: 'Kolkata',   state: 'West Bengal',   tier: 1, covered: true },
  { pincode: '700019', lat: 22.5200, lon: 88.3600, city: 'Kolkata',   state: 'West Bengal',   tier: 1, covered: true },

  // ── Hyderabad ────────────────────────────────────────────────────────
  { pincode: '500001', lat: 17.3850, lon: 78.4867, city: 'Hyderabad', state: 'Telangana',     tier: 1, covered: true },
  { pincode: '500034', lat: 17.4375, lon: 78.4483, city: 'Hyderabad', state: 'Telangana',     tier: 1, covered: true },

  // ── Pune ─────────────────────────────────────────────────────────────
  { pincode: '411001', lat: 18.5204, lon: 73.8567, city: 'Pune',      state: 'Maharashtra',   tier: 1, covered: true },
  { pincode: '411006', lat: 18.5530, lon: 73.8200, city: 'Pune',      state: 'Maharashtra',   tier: 1, covered: true },

  // ── Ahmedabad ────────────────────────────────────────────────────────
  { pincode: '380001', lat: 23.0225, lon: 72.5714, city: 'Ahmedabad', state: 'Gujarat',       tier: 1, covered: true },
  { pincode: '380006', lat: 23.0340, lon: 72.5850, city: 'Ahmedabad', state: 'Gujarat',       tier: 1, covered: true },

  // ── Jaipur ───────────────────────────────────────────────────────────
  { pincode: '302001', lat: 26.9124, lon: 75.7873, city: 'Jaipur',    state: 'Rajasthan',     tier: 2, covered: true },

  // ── Lucknow ──────────────────────────────────────────────────────────
  { pincode: '226001', lat: 26.8467, lon: 80.9462, city: 'Lucknow',   state: 'Uttar Pradesh', tier: 2, covered: true },

  // ── Patna ────────────────────────────────────────────────────────────
  { pincode: '800001', lat: 25.5941, lon: 85.1376, city: 'Patna',     state: 'Bihar',         tier: 2, covered: true },
];
