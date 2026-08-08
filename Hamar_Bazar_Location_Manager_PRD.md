# Product Requirements Document (PRD)
## Hamar Bazar — Location Manager (Admin Map System)

**Version:** 1.0
**Prepared for:** Hamar Bazar
**Scope Area:** Takhatpur

---

## 1. Overview

Hamar Bazar ke liye ek **Admin Map-based Location Manager** banaya jayega jisme admin Takhatpur area ke Users, Shops aur Orders ko Google Map par custom PNG markers ke through manage kar sakega. Marker location zoom/pan ke baad bhi exact geographic coordinate (lat/lng) par hi render hogi, kyunki position screen-pixel base par nahi balki lat/lng base par fix hogi.

**Core Principle:** Google Maps sirf ek rendering/coordinate engine hai. Actual business data (users, shops, orders, relationships) Hamar Bazar ke apne Flask backend + database me store aur manage hoga.

---

## 2. Problem Statement

Abhi Hamar Bazar ke paas users, shops, aur orders ka data hai, lekin unhe geographically visualize karne, manage karne, aur new locations add karne ka koi centralized admin tool nahi hai. Isse:

- Admin ko pata nahi chalta ki shops/users kahan geographically located hain
- Delivery ke liye order location manually track karna padta hai
- Naye shop/user ko map par add karna structured tarike se possible nahi hai

---

## 3. Goals & Objectives

| Goal | Description |
|---|---|
| G1 | Admin Takhatpur-centered map par shops, users, orders visually dekh sake |
| G2 | Map par click karke naya shop/user location add kar sake |
| G3 | Custom PNG markers (type-wise: shop/user/order) use ho |
| G4 | Marker drag karke location update ho sake |
| G5 | Search aur filter se relevant locations jaldi milen |
| G6 | Zoom/pan ke baad bhi marker exact geographic point par rahe |
| G7 | Sirf authorized admin hi location add/edit/delete kar sake |

### Non-Goals (v1 me nahi)
- Customer-facing map (sirf admin panel)
- Real-time delivery tracking / live rider location
- Route optimization / distance calculation

---

## 4. Target User

**Primary User:** Hamar Bazar Admin (single admin ya limited internal staff)

**User Story Examples:**
- "Admin ke roop me, main naya shop map par click karke add kar sakun, taaki uski exact location record ho."
- "Admin ke roop me, main existing user ko search karke uski location assign kar sakun."
- "Admin ke roop me, main marker par click karke shop/user/order ka detail dekh sakun."
- "Admin ke roop me, main galat location wale marker ko drag karke correct kar sakun."

---

## 5. Scope

### In Scope (v1 — MVP)
- Takhatpur fixed-center Google Map
- Shop, User, Order — teeno ke liye custom PNG markers
- Map click se naya shop add karna
- Existing user ko location assign karna
- Order ki delivery location map par show karna
- Marker click se detail popup
- Basic filter (Shop/User/Order toggle)
- Basic search
- Admin authentication (login-protected)
- SQLite database se start

### In Scope (Later Phases)
- Marker drag-to-update
- Status-based order markers (delivered/pending/cancelled)
- Takhatpur boundary validation
- Marker clustering (large data ke liye)
- Viewport-based lazy loading
- PostgreSQL migration
- Production deployment (Nginx + HTTPS)

### Out of Scope
- Customer-side app changes
- Payment/order processing logic (existing system se untouched)

---

## 6. System Architecture (High Level)

```
Admin → Admin Map UI (HTML/CSS/JS) → Google Maps (rendering engine)
                                    → Flask REST API → Database (SQLite → PostgreSQL)
```

- **Google Maps** = Map engine (base map, zoom/pan, coordinate system, marker rendering)
- **Flask + DB** = Business/Data engine (users, shops, orders, markers, relationships, permissions)

---

## 7. Functional Requirements

### 7.1 Map Display
- FR1: Map load hote hi Takhatpur coordinates par centered ho, default zoom level 14
- FR2: Map par shop/user/order teeno type ke custom PNG markers dikhen
- FR3: Marker position lat/lng se bound ho, zoom/pan se independent

### 7.2 Add Location
- FR4: Admin "Add Location" button click kare → map par click kare → lat/lng capture ho
- FR5: Location type select karna ho: Shop / User / Other
- FR6: Shop select karne par form khule (Name, Owner, Mobile, Category) → Save → `POST /api/shops`
- FR7: User select karne par existing user search ho → select → `PUT /api/users/<id>/location`

### 7.3 Marker Interaction
- FR8: Marker click karne par detail popup khule (API call se live data fetch ho)
- FR9: Marker drag karke naya lat/lng capture ho aur `PUT` API se update ho (Phase 2)

### 7.4 Filters & Search
- FR10: Checkbox filters — Shops / Users / Orders / Other — toggle se markers show/hide hon
- FR11: Search bar se name search ho, result par click se map us location par pan+zoom ho

### 7.5 Security
- FR12: Sirf logged-in admin hi add/edit/delete kar sake
- FR13: Public/customer access ke liye ye APIs available na hon

---

## 8. Data Model

### Users Table
| Field | Type |
|---|---|
| id | PK |
| name | string |
| mobile | string |
| address | string |
| latitude | float |
| longitude | float |
| created_at / updated_at | timestamp |

### Shops Table
| Field | Type |
|---|---|
| id | PK |
| name | string |
| owner_name | string |
| mobile | string |
| latitude | float |
| longitude | float |
| category | string |
| created_at / updated_at | timestamp |

### Orders Table
| Field | Type |
|---|---|
| id | PK |
| user_id | FK → users |
| shop_id | FK → shops |
| amount | decimal |
| status | enum (pending/delivered/cancelled) |
| delivery_latitude | float |
| delivery_longitude | float |
| created_at / updated_at | timestamp |

**Note:** User ki apni saved location aur uske order ki delivery location alag-alag store hoti hai — dono same nahi maane jayenge.

---

## 9. API Requirements

```
/api
├── /auth
│   ├── POST /login
│   └── POST /logout
│
├── /users
│   ├── GET /
│   ├── GET /<id>
│   └── PUT /<id>/location
│
├── /shops
│   ├── GET /
│   ├── POST /
│   ├── GET /<id>
│   ├── PUT /<id>
│   └── PUT /<id>/location
│
├── /orders
│   ├── GET /
│   └── GET /<id>
│
├── /search
│   └── GET /?q=
│
└── /map
    └── GET /locations
```

`GET /api/map/locations` response format:
```json
[
  { "id": 101, "type": "shop", "name": "Sharma Kirana", "lat": 22.596512, "lng": 81.965234 },
  { "id": 25,  "type": "user", "name": "Rahul",         "lat": 22.598100, "lng": 81.967500 }
]
```

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Map load < 2s; API response < 500ms for typical dataset |
| Scalability | v1: SQLite, ~100s of records. Future: PostgreSQL + clustering for 10,000+ records |
| Security | Admin-authenticated write access; Google Maps API key restricted (HTTP referrer + API restriction) |
| Reliability | Marker position accuracy tied to lat/lng, not pixel — must remain correct across zoom/pan |
| Usability | Admin ko bina training ke Add/Search/Filter use karna aasan ho |

---

## 11. Marker Configuration

Centralized config rakha jayega taaki icons future me easily change ho sakein:

```js
const MARKER_CONFIG = {
  shop:  { icon: "/static/markers/shop.png" },
  user:  { icon: "/static/markers/user.png" },
  order: { icon: "/static/markers/order.png" },
  other: { icon: "/static/markers/other.png" }
};
```

Future enhancement: order status ke hisaab se alag icon (delivered/pending/cancelled).

---

## 12. Development Roadmap (Phases)

| Phase | Deliverable |
|---|---|
| Phase 1 | Google Map setup, Takhatpur center, zoom/pan |
| Phase 2 | Custom PNG markers, fixed lat/lng binding |
| Phase 3 | Add Location flow (map click → form → DB save) |
| Phase 4 | Existing Users/Shops/Orders data ko map par integrate karna |
| Phase 5 | Search, Filters, Edit, Drag Marker, Delete, Detail Popup |
| Phase 6 | Production hardening — Auth, API security, PostgreSQL, Clustering, Viewport loading, Caching, Logging |

**Recommended approach:** Phase 1–3 se MVP banaye (SQLite based), fir Phase 4 me existing Hamar Bazar data integrate kare, uske baad Phase 5–6 production ke liye.

---

## 13. Success Metrics

- Admin bina developer help ke naya shop/user location 1 minute se kam me add kar sake
- Map par 100% existing shops/users correctly geo-plotted hon
- Zero incorrect marker position after zoom/pan testing
- Unauthorized user location write attempt = 0% success rate

---

## 14. Assumptions & Dependencies

- Google Maps JavaScript API key available hoga (billing enabled)
- Existing Hamar Bazar users/shops/orders tables me lat/lng column add karne ki permission hogi
- Admin panel already kisi authentication system se protected hai ya naya banega

---

## 15. Open Questions

- [ ] Takhatpur ke bahar location add karne par hard-reject chahiye ya sirf warning?
- [ ] Kya multiple admins simultaneously kaam karenge (concurrent edit handling)?
- [ ] Order status real-time update hoga ya periodic refresh se?
- [ ] PostgreSQL migration ka timeline kab tak expected hai?

