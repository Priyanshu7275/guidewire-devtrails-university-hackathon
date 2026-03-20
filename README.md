![Gig Shield](https://o9yqetpj645smjx6.public.blob.vercel-storage.com/Gig%20Shield.png)

>> GigShield - AI-Powered Income Protection for Delivery Partners

- "When work stops, income should not." 
- *AI-based parametric insurance platform* that automatically compensates delivery workers for income loss due to:
- Rain | Pollution | Heat | Curfews | Platform outages  
- *No claims. No paperwork. Instant UPI payouts in <90 seconds.*






>> About:

> *Guidewire DEVTrails 2026* | University Hackathon Submission  
> *Persona:* Grocery / Q-Commerce Delivery Partners (Zepto, Blinkit, Swiggy Instamart)  
> *Platform:* Web Application  
> *Coverage:* Loss of Income ONLY (No health, life, accidents, or vehicle repairs)



>>  The Problem


India's Q-commerce delivery workers operate in *high-risk, hyper-local environments*.

-> When disruptions happen:
-  Rain
-  AQI spikes
-  Extreme heat
-  Curfews

> *Income drops instantly*

>>  Reality:
- 2-6 hours of lost work = Rs.150- Rs.300 lost daily
- No insurance product covers *income loss*
- Workers bear 100% of the risk

> *This is a completely unprotected financial gap.*



>>  The Solution - GigShield

GigShield uses *parametric triggers + AI validation* to:

- Detect real-world disruptions automatically  
- Validate worker presence using GPS  
- Run fraud checks using ML  
- Trigger instant payouts via UPI  

No claim filing. No waiting. Fully automated.



>>  Persona & Real-Life Scenarios

# Ravi Kumar (26) - Delivery Partner (Blinkit, Ghaziabad)

-  Works 8-10 hrs/day  
-  Earns Rs.4K- Rs.5K/week  
-  Operates in local zones  
-  Uses UPI & smartphone apps  

>>  Scenario 1: Heavy Rain

- Rainfall > 15mm/hr  
- Orders drop by 80%  
- Worker inactive due to safety  

 *GigShield Action:*
- Detects rain via API  
- Confirms GPS location  
-  Pays Rs. 160 instantly  

>> Scenario 2: Dangerous AQI (Environmental Trigger)

- AQI crosses 300+ (hazardous level)
- Authorities advise limiting outdoor activity
- Worker exposure becomes unsafe

>> *GigShield Action:*
- Detects AQI breach via CPCB API
- Checks recent worker activity (active in last hour)
- Validates location in affected zone
- Instant payout: ₹200 (≈4 hours lost income)

>> Scenario 3: Local Curfew / Strike (Social Trigger)

- Section 144 / curfew imposed in zone
- Movement restrictions enforced
- Deliveries completely halted

>> *GigShield Action:*
- Detects disruption via news/govt alert APIs
- Confirms worker presence in restricted zone
- Validates inability to operate
- Instant payout: Rs. 300 (approx. 6 hours lost income)




>> Why Q-Commerce? Why This Persona?

   | Factor |                                                    | Why It Matters |

Hyper-local zone|                            Pin-code level ML risk modeling is possible and meaningful
Short delivery sprints                       Even 2-hour disruptions = significant income loss
High outdoor exposure                        Weather and AQI hit these workers harder than office workers
UPI-native                                   Instant digital payouts are frictionless
Underserved segment                          Less explored than food delivery - differentiation advantage



>>  Weekly Premium Model

Gig workers operate week-to-week. GigShield's financial model is structured entirely on a *7-day rolling premium cycle.*

>> Premium Formula

>Premium adapts weekly based on *risk + behavior + environment*
>Weekly Premium = Base Premium
                 + Zone Risk Score Adjustment  (ML model output)
                 + Worker Tenure Adjustment    (loyalty discount)
                 + Seasonal Risk Factor        (monsoon / summer uplift)


>> Example Breakdown

| Component |                             Value |                                          Notes |
|---|---|---|
| Base Premium |                             Rs.35/week |                              Fixed starting point |
| Zone Risk (High - Noida Sector 62) |      +Rs.12 |                                   Historically flood-prone |
| Zone Risk (Low - South Delhi) |           -Rs.8 |                                    Low waterlogging history |
| Tenure Bonus (>3 months) |                -Rs.5 |                                    Loyalty discount |
| Monsoon Season Uplift |                   +Rs.8 |                                    June-September |
| *Final Range* |                         Rs.25-Rs.60/week |                           Dynamic per worker |

>> Coverage

| Tier |                      Weekly Premium |          Max Weekly Payout |                    Coverage Hours/Week |
|---|---|---|---|
| Basic |                      Rs.25 |                        Rs.500 |                                 Up to 10 hrs |
| Standard |                   Rs.40 |                        Rs.900 |                                 Up to 18 hrs |
| Premium |                    Rs.60 |                        Rs.1,400 |                               Up to 28 hrs |

*Payout Rate:* Based on worker's declared avg hourly earnings (verified against onboarding data)



>>  Parametric Triggers

> Payouts are triggered automatically when an external data threshold is crossed. No manual claim required.

| # |  Trigger |             Source |                                Threshold |                                          Impact |
|---|---|---|---|---|
| 1 | Heavy Rain |          OpenWeatherMap API |              Rainfall > 15mm/hr in worker's zone |                          Deliveries halted |
| 2 | Dangerous AQI |       CPCB AQI API (mock fallback) |           AQI > 300 in worker's zone |                      Unsafe to ride outdoors |
| 3 | Extreme Heat |        IMD / OpenWeatherMap |               Temperature > 43°C |                                       Cannot work safely |
| 4 | Local Curfew /        Strike | News API + Govt alert mock |    Zone flagged active |                           Cannot access pickup/drop |
| 5 | Platform Outage |     Zepto/Blinkit mock API |                 Downtime > 45 mins |                                  No orders available |

*Validation before payout (anti-fraud):*
1 Was the worker's GPS inside the disrupted zone at trigger time?
2 Did platform activity logs show a drop in orders for that zone?
3 Has this worker filed a claim for the same event already?



>>  AI / ML Integration Plan

> 1 Hyper-Local Zone Risk Scoring Model
- *Input:* Historical IMD weather data, CPCB AQI records, past disruption events per pin-code, waterlogging history
- *Output:* 'Zone Risk Score (0-100)' per pin-code per week
- *Model:* XGBoost regressor trained on 2-3 years of synthetic + publicly available data
- *Used for:* Dynamic premium adjustment per worker based on their delivery zone(s)

> 2 Dynamic Weekly Premium Calculator
- *Input:* Zone Risk Score, worker tenure, season, declared earnings
- *Output:* Recommended weekly premium tier
- *Model:* Rule-based engine on top of ML zone score (Phase 2), evolving to full ML in Phase 3

> 3 Fraud Detection Model
- *Input:* GPS trace, claim timestamps, zone AQI/weather ground truth, platform activity logs (mock)
- *Output:* Fraud probability score (0-1); scores > 0.7 flag for review
- *Model:* Isolation Forest for anomaly detection + rule-based checks
- *Catches:* GPS spoofing, fake zone claims, duplicate claims for the same event, mass coordinated fraud

> 4 Disruption Trigger Classifier
- *Input:* Real-time API data (weather, AQI, news feeds)
- *Output:* Binary trigger decision (Payout / No Payout) per zone per worker
- *Logic:* Threshold-based in Phase 2; ML classifier in Phase 3 for edge cases

> 5 Predictive Risk Dashboard (Phase 3)
- *Input:* 7-day weather forecasts, historical disruption patterns
- *Output:* "Next week's predicted claims" for insurer admin dashboard
- *Purpose:* Help insurer manage reserves and loss ratios proactively

---

>>  Platform Choice: Web Application

*We chose a Web platform over Mobile for the following reasons:*

| Factor | Web | Mobile |
|---|---|---|
| Development speed | Faster for hackathon timeline | Slower (native builds) |
| Admin / insurer dashboard | Natural fit | Awkward on small screen |
| Demo-ability | Easy screen recording | Requires device/emulator |
| Worker onboarding | Progressive Web App works on any phone | Requires app install |

The worker-facing interface will be a *mobile-first responsive web app* (works on any smartphone browser with no install required), while the admin dashboard will be a full desktop web UI.



>>  Application Workflow


Worker Onboarding
       ↓ 
   Risk Profiling (ML Zone Score)
       ↓
   Policy Creation (Weekly Premium Calculated)
       ↓
   Premium Payment (UPI / Razorpay)
       ↓
   [Policy Active - 7 Days]
       ↓
   Real-Time Disruption Monitoring (APIs polling every 15 min)
       ↓
   Trigger Detected -> Fraud Check -> GPS Validation
       ↓
   Claim Auto-Initiated -> Payout Approved
       ↓
   Instant UPI Payout -> Worker Notified
       ↓
   Admin Dashboard Updated (Loss Ratio, Fraud Flags)




>>  Tech Stack

> Backend
| Layer | Technology |
|---|---|
| API Framework | Python + FastAPI |
| ML Models | scikit-learn, XGBoost, pandas, numpy |
| Database | PostgreSQL |
| Cache / Triggers | Redis (real-time trigger state) |
| Task Queue | Celery (async trigger monitoring) |

> Frontend
| Layer | Technology |
|---|---|
| Framework | React.js |
| Styling | Tailwind CSS |
| Charts / Dashboard | Recharts |
| Maps (zone visualization) | Leaflet.js |

> Integrations
| Service | Purpose | Approach |
|---|---|---|
| OpenWeatherMap API | Rain, temperature triggers | Free tier (real) |
| CPCB AQI | Air quality triggers | Mock fallback if needed |
| News / Curfew API | Social disruption triggers | Mock JSON feed |
| Zepto/Blinkit API | Platform outage + order drop | Simulated |
| Razorpay | Payout processing | Test mode / sandbox |

> Infrastructure
| Component | Tool |
|---|---|
| Hosting | Render.com (free tier) |
| Version Control | GitHub |
| CI/CD | GitHub Actions (basic) |



>>  6-Week Development Plan

| Phase |                     Weeks |                                           Key Milestones |
|---|---|---|
| Phase 1 |           Weeks 1-2 (Mar 4-20) |                    Ideation, README, architecture, GitHub setup, 2-min video |
| Phase 2 |           Weeks 3-4 (Mar 21-Apr 4) |                Onboarding, ML premium calc, policy engine, 3-5 triggers, auto-claim flow |
| Phase 3 |           Weeks 5-6 (Apr 5-17) |                    Fraud detection, mock payouts, dual dashboard, 5-min demo, pitch deck |


>>  Team

> *(Add your team member names, roles, and institution here)*



>>  Coverage Exclusions (as per contest rules)

GigShield strictly covers *loss of income only* due to external uncontrollable disruptions.

The following are explicitly *excluded* from coverage:
-  Health or medical expenses
-  Life insurance
-  Accident claims
-  Vehicle repair or maintenance
-  Any event caused by the worker's own negligence



>>  Market Opportunity

- 10M+ gig workers in India  
- Q-commerce growing rapidly  
- No income protection exists  

> GigShield taps an *untapped insurance market*

>> Revenue Model

- Weekly subscription (Rs.25-Rs.60)  
- Platform partnerships (Zepto/Blinkit)  
- Risk analytics for insurers  


*Built for Guidewire DEVTrails 2026
