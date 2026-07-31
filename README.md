# 🚗 WashPro v2.0
**Car Wash CRM & Invoice Platform** — Built by OS2 Studio for Aurae Software Solutions

---

## 📁 Project Structure

```
src/
├── App.js                          ← Root component & page router
├── index.js                        ← Entry point (applies theme before render)
├── index.css                       ← Global styles + CSS variables (light/dark)
├── App.css                         ← Minimal app-level overrides
│
├── hooks/
│   ├── useTheme.js                 ← Dark/light theme toggle + persistence
│   ├── useNotification.js          ← Toast notification stack
│   └── useAppData.js               ← Central data state (users, sessions, etc.)
│
├── utils/
│   ├── theme.js                    ← CSS variable injector + theme tokens
│   ├── db.js                       ← localStorage persistence layer
│   ├── defaults.js                 ← Seed data (users, packages, branches)
│   ├── pdf.js                      ← Invoice PDF generator (jsPDF + autoTable)
│   └── messaging.js                ← WhatsApp + push notification helpers
│
├── components/
│   ├── common/
│   │   └── UI.jsx                  ← Btn, Inp, Sel, Chip, Card, Modal, Toast, etc.
│   └── layout/
│       └── AdminShell.jsx          ← Admin sidebar + topbar + mobile menu
│
└── pages/
    ├── LoginPage.jsx               ← Login + OTP flow
    ├── washer/
    │   └── WasherApp.jsx           ← 7-step washer mobile flow
    └── admin/
        ├── Dashboard.jsx           ← KPI cards + charts + recent sessions
        ├── Sessions.jsx            ← Session history + filters + PDF/WhatsApp
        ├── Customers.jsx           ← Customer CRM + visit history (NEW)
        ├── Branches.jsx            ← Multi-branch management (NEW)
        └── AdminPages.jsx          ← Washers, Credentials, Packages, QR, Reports, Map
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm start

# 3. Build for production
npm run build
```

---

## 🔑 Demo Credentials

| Role   | Username   | Password  | OTP    |
|--------|------------|-----------|--------|
| Admin  | `admin`    | `admin123`| 123456 |
| Washer | `washer01` | `pass123` | 123456 |
| Washer | `washer02` | `pass123` | 123456 |

---

## ✨ What's New in v2.0

### UI / Design
- ✅ **Dark / Light theme toggle** — persists across sessions, no flash on load
- ✅ **Redesigned Admin Panel** — collapsible sidebar, sticky topbar, smooth navigation
- ✅ **Mobile-first Washer App** — step progress bar, improved spacing & touch targets
- ✅ **Plus Jakarta Sans** — premium typography throughout
- ✅ **CSS variable theming** — every colour token exposed, easy to rebrand

### New Features
- ✅ **Customer CRM** — auto-created on checkout with phone number, full visit history, notes
- ✅ **Multi-branch support** — washers assigned to branches, sessions tagged by branch, branch revenue reports
- ✅ **Invoice PDF download** — proper A5 PDF via jsPDF + autoTable with WashPro branding
- ✅ **WhatsApp sharing** — pre-formatted invoice message with `wa.me` deep link
- ✅ **Push notifications** — browser push on invoice creation (requires permission)

### Architecture
- ✅ **Full folder structure** — hooks, utils, components, pages
- ✅ **useAppData hook** — single source of truth for all app state
- ✅ **useTheme hook** — clean theme management
- ✅ **useNotification hook** — toast stack, multiple simultaneous toasts
- ✅ **DB utility** — localStorage layer with customer upsert logic
- ✅ **PDF utility** — async PDF generator, importable anywhere

---

## 📦 Key Dependencies

| Package           | Purpose                        |
|-------------------|--------------------------------|
| `react` 18        | UI framework                   |
| `recharts`        | Charts (bar, pie, line)        |
| `jspdf`           | PDF generation                 |
| `jspdf-autotable` | PDF tables                     |
| `react-scripts`   | CRA build toolchain            |

---

## 🌐 Deployment

### Railway / Netlify / Vercel
```bash
npm run build
# Deploy the /build folder
```

### Environment Variables
No env vars required for the base app.
For production AI scanning, the Anthropic API key is handled by the Claude Artifact environment.
If self-hosting, add to your reverse proxy headers:
```
anthropic-dangerous-direct-browser-access: true
```

---

## 📞 Built by OS2 Studio
- 🌐 os2studio.com
- 📧 design@os2studio.com
- 📍 Dindigul, Tamil Nadu, India
