# Game Trend Radar 📡🎮

> Cross-platform game market intelligence and trend analyzer for indie developers and studios (Roblox, Yandex Games, YouTube Shorts, Poki).

---

## 🎯 Purpose

Developing a game takes weeks or months. Game Trend Radar prevents the biggest mistake in game development: building a game nobody wants, or entering a saturated red ocean dominated by multi-million-dollar publishers.

The system gathers real-time storefront metrics, classifies gameplay archetypes, and calculates the **Opportunity Score**, outputting an actionable verdict:
- 🟢 **Green Light:** High demand, surging velocity, low saturation, rapid build time (1-4 weeks).
- 🟡 **Yellow Light:** Stable niche, but requires a unique hook (USP) or established asset pipeline.
- 🔴 **Red Light:** Saturated red ocean, declining player interest, or excessive production scope.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ (or Bun)
- npm

### Installation
```bash
npm install
```

### Commands
```bash
# Scan all storefronts (Roblox, Yandex Games, Poki)
npm run scan

# Generate comprehensive market report
npm run report

# Get top recommendations on what to build
npm run recommend
```

---

## 📚 Knowledge Base & Documentation

All core documentation, game design specifications, and prompt roadmaps reside in the Obsidian Vault:
`10 Projects/11 Active/Game Trend Radar — Анализ Рынка и Трендов Игр/`:
- **00 Passport & Vision**
- **01 Data Sources & API Specifications**
- **02 Scoring Model & Decision Engine**
- **03 Game Archetypes & Virality Catalog**
- **08 Prompt Catalog & Code Generation Roadmap**
- **implementation-notes.md** (repository root)

---

## 🛠 Tech Stack
- **Runtime:** Node.js 20+ / TypeScript (ES2022, NodeNext)
- **Execution:** `tsx`
- **Protocols:** Native `fetch`, HTTP/2, REST APIs, SSR HTML streaming
- **Philosophy:** Modular adapters, strict typing, YAGNI, senior-grade simplicity.
