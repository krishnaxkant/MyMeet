# Meet

Cross-platform video conferencing application for **Web** (React + Vite) and **Android** (React Native + Expo), backed by **Node.js + Express**, **Supabase (PostgreSQL + RLS)**, and **LiveKit SFU**.

## Project Structure

- `apps/web` — React + Vite + TypeScript website
- `apps/mobile` — React Native + Expo + TypeScript Android app
- `server` — Node.js + Express + TypeScript backend API
- `shared` — Shared TypeScript types and utilities
- `supabase/migrations` — PostgreSQL schema & Row Level Security migrations

## Phase 1 (Milestone 1) Setup

### 1. Environment Variables
Copy `.env.example` to `.env` in the repository root and fill in your Supabase credentials:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (backend only — never put in frontend code)

### 2. Apply Supabase Schema
Run the SQL in `supabase/migrations/20261124000001_initial_schema.sql` in your Supabase SQL Editor (or via the Supabase CLI).

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Services
Start each service in its own terminal:

```bash
# Backend API (http://localhost:4000)
npm run dev:server

# Web App (http://localhost:5173)
npm run dev:web

# Android App (Expo)
npm run dev:mobile
```

### 5. Verify Milestone 1
- Backend health check: `GET http://localhost:4000/api/health`
- Open `http://localhost:5173` — the Web dashboard should show live Backend and Supabase connectivity status.
- Launch Expo on an Android emulator or device — the Android app should connect to `/api/health` and show live status.
