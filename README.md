# 🤖 WhatsApp AI Sales & Support Agent

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-orange.svg?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)
[![Deepgram](https://img.shields.io/badge/Deepgram-STT_Audio-13EF93.svg?style=for-the-badge&logo=deepgram)](https://deepgram.com/)
[![Baileys](https://img.shields.io/badge/WhatsApp-Baileys_MD-25D366.svg?style=for-the-badge&logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)

An autonomous, multi-tenant capable **WhatsApp AI Sales & Customer Support Agent**. Powered by **Google Gemini** for conversational intelligence, **Deepgram** for high-accuracy voice note transcription, and **Baileys** for seamless multi-device WhatsApp connectivity.

Includes a comprehensive, modern **React 19 management dashboard** with real-time QR pairing, campaign broadcaster, product catalog, payment gateway settings (Easypaisa / JazzCash / Bank), and Deepgram account health monitoring with automatic failovers.

---

## 🌟 Key Highlights

- **🧠 Intelligent LLM Agent**: Converses fluently with potential customers in **Roman Urdu**, **Urdu**, and **English**, tailoring responses to close deals, address objections, and recommend software/services.
- **🎙️ Voice Note Transcription**: Automatically transcribes customer voice notes via Deepgram STT, enabling the agent to understand and answer voice messages seamlessly.
- **⚡ Human-Like Response Behavior**: Configurable simulated typing status, realistic delays (`responseDelaySeconds`), and natural conversational pacing to prevent account flagging.
- **💼 Products & Pricing Catalog**: Built-in knowledge base (`tools.json` and `plans.json`) loaded with features, tiers (Free, Pro, Agency, Enterprise), pricing in PKR & USD, and objection handling FAQs.
- **💳 Payment Management**: Auto-delivers localized payment details (Easypaisa, JazzCash, manual transfers) and payment verification instructions.
- **📊 Interactive Admin Dashboard**: Real-time control panel built with React 19, Tailwind CSS v4, Motion, and Lucide icons.
- **🔄 Multi-Account Failover System**: Built-in multi-key Deepgram pool management with automatic balance checks, usage metrics, and failovers.
- **🚀 Production Ready**: Out-of-the-box support for cPanel Phusion Passenger, Linux VPS (systemd/PM2), or local development.

---

## 🏗️ Architecture Overview

> 📖 **Complete Architecture & Internal Workflow Guide:** For the full in-depth technical documentation including diagrams, CRM state transitions, prompt synthesis, and Deepgram pool routing, see [**`ARCHITECTURE_AND_WORKFLOW.md`**](ARCHITECTURE_AND_WORKFLOW.md).

```
                          ┌──────────────────────────┐
                          │   Customer on WhatsApp   │
                          └─────────────┬────────────┘
                                        │  (Text / Voice Note)
                                        ▼
                          ┌──────────────────────────┐
                          │  Baileys WhatsApp Socket │
                          └─────────────┬────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           │                                                         │
     [Audio Message]                                           [Text Message]
           │                                                         │
           ▼                                                         ▼
┌───────────────────────┐                                 ┌───────────────────────┐
│ Deepgram STT Service  │                                 │ Context & Catalog     │
│ (Multi-Key Pool Engine)│                                │ (tools, plans, style) │
└──────────┬────────────┘                                 └──────────┬────────────┘
           │ (Transcribed Text)                                      │
           └────────────────────────────┬────────────────────────────┘
                                        ▼
                          ┌──────────────────────────┐
                          │   Gemini AI Intelligence │
                          │   (Sales Pitch Engine)   │
                          └─────────────┬────────────┘
                                        │
                                        ▼
                          ┌──────────────────────────┐
                          │  Auto-Reply + Payments   │
                          │   (Human-like delay)     │
                          └─────────────┬────────────┘
                                        │
                                        ▼
                          ┌──────────────────────────┐
                          │   Customer on WhatsApp   │
                          └──────────────────────────┘
```

---

## 📁 Repository Structure

```text
├── app.js                   # Passenger entry point for cPanel / CloudLinux
├── package.json             # Dependencies and scripts (React 19, Baileys, Gemini, Vite, Express)
├── .gitignore               # Ignored directories (node_modules, logs, .env)
├── .htaccess                # LiteSpeed / Phusion Passenger server configuration
│
├── data/                    # JSON-backed database & runtime storage
│   ├── auth/                # Baileys WhatsApp multi-device authentication session
│   ├── audit_logs.json      # System event tracking & audit logs
│   ├── campaign.json        # Scheduled & active WhatsApp campaigns
│   ├── customers.json       # Customer CRM records, leads, and message histories
│   ├── deepgram_accounts.json # Deepgram API credentials pool with balances & stats
│   ├── deepgram_config.json # Voice transcription preferences and settings
│   ├── lists.json           # Contact broadcast lists and segments
│   ├── plans.json           # Subscription plans and pricing tiers
│   ├── settings.json        # AI agent behavior, chat style, and payment accounts
│   ├── tools.json           # Product catalog, features, pricing, and sales arguments
│   ├── usage.json           # AI token consumption & interaction statistics
│   └── users.json           # Dashboard authentication users & roles
│
└── dist/                    # Compiled production build
    ├── index.html           # Dashboard single-page application
    ├── server.cjs           # Bundled Express server & WhatsApp backend
    └── assets/              # Minified CSS, JS bundles, and static UI assets
```

---

## ⚙️ Configuration & Customization

The agent's behavior, tone, and payment accounts can be configured either via the Admin Dashboard or directly in [`data/settings.json`](file:///d:/Git%20Tools/salesagent/data/settings.json):

```json
{
  "aiAgentEnabled": true,
  "preferredApi": "gemini",
  "defaultLLM": "Gemini",
  "language": "Roman Urdu",
  "autoReply": true,
  "humanLikeMode": true,
  "chatStyle": "casual_roman_urdu",
  "maxTokens": 150,
  "responseDelaySeconds": 1.5,
  "paymentInstructions": "Payment send karne ke baad screenshot share karein...",
  "paymentMethods": [
    {
      "provider": "Easypaisa",
      "accountTitle": "Account Name",
      "accountNumber": "0300XXXXXXX",
      "isActive": true
    }
  ]
}
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: v18.x or higher (Node 20+ / 22+ recommended)
- **npm** or **pnpm**
- Active **Google Gemini API Key** and **Deepgram API Key**

### 1. Clone the Repository
```bash
git clone https://github.com/badarbukharidev-alt/Whatsapp-Sales-Agent.git
cd Whatsapp-Sales-Agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Locally
To run the server:
```bash
npm start
```
Or for local development:
```bash
npm run dev
```

Open your browser at `http://localhost:3000` to access the Management Dashboard and scan the WhatsApp QR Code.

---

## 🌐 Deployment

### cPanel / CloudLinux (Phusion Passenger)
1. Upload the repository files to your subdomain folder (e.g., `public_html/sales-agent`).
2. Set up a **Node.js Application** via cPanel:
   - **Node.js Version**: 20.x or 22.x
   - **Application Root**: Path to your application
   - **Application Startup File**: `app.js`
3. Run `npm install --production` inside the terminal.
4. Restart the Node.js application from cPanel.

### Linux VPS (PM2)
```bash
npm install -g pm2
pm2 start dist/server.cjs --name "whatsapp-sales-agent"
pm2 save
pm2 startup
```

---

## 🛡️ Anti-Ban & Best Practices
- Keep `humanLikeMode: true` and `responseDelaySeconds` between `1.5` and `3.5` seconds.
- Warm up new WhatsApp numbers gradually before initiating large broadcast campaigns.
- Use the built-in blacklist and unsubscribe tags in `data/lists.json`.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
