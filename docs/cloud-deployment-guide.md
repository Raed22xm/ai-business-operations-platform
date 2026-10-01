# Cloud Website Deployment Guide

This guide walks you through deploying the **AI Business Operations Platform** so it is permanently hosted on the web 24/7. You can access it anytime from any computer or phone by opening your website URL.

---

## Architecture Overview

```
 [Browser Anywhere]
        │
        ▼ (HTTPS)
┌─────────────────────────────────┐
│       Vercel (Frontend)         │  URL: https://your-app.vercel.app
│   Next.js 16 (App Router)       │
└────────────────┬────────────────┘
                 │ Server-to-Server REST (HTTPS)
                 ▼
┌─────────────────────────────────┐
│     Cloud Backend Container     │  URL: https://api.your-app.onrender.com
│    .NET 10 (AiBusiness.Api)     │  (Render / Railway / Fly.io)
└────────────────┬────────────────┘
                 │ EF Core 10 (Encrypted SSL)
                 ▼
┌─────────────────────────────────┐
│  Serverless PostgreSQL Database │  (Neon.tech or Render Postgres)
│   All 9 Migrations Automated    │
└─────────────────────────────────┘
```

---

## Step 1: Database (Neon.tech or Render)

### Option A: Free Serverless PostgreSQL on Neon.tech (Recommended)
1. Go to [neon.tech](https://neon.tech) and sign up (free, takes 30 seconds with GitHub).
2. Create a project named `aibusiness`.
3. Copy the **Connection Details** connection string. It will look like:
   ```text
   postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/aibusiness?sslmode=require
   ```

*(Alternatively, if using Render Blueprint in Step 2, a free PostgreSQL database is created automatically).*

---

## Step 2: Deploy Backend API (.NET 10) on Render or Railway

### Using Render (Free & automated with the included `render.yaml`):
1. Push your latest code to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: add cloud deployment configs"
   git push origin main
   ```
2. Log into [render.com](https://render.com) with GitHub.
3. Click **New +** -> **Blueprint**.
4. Select your repository `ai-business-operations-platform`.
5. Render will automatically detect `render.yaml` and configure:
   - Managed PostgreSQL database `aibusiness-db`
   - Web Service `aibusiness-api` targeting `backend/Dockerfile`
   - All environment variables and secrets automatically!
6. Click **Apply**.
7. Once deployed, copy your backend URL (e.g., `https://aibusiness-api-xxxx.onrender.com`).

*(If using Neon.tech instead of Render DB, simply update the `ConnectionStrings__DefaultConnection` environment variable in the Render dashboard to your Neon connection string).*

---

## Step 3: Deploy Frontend (Next.js) on Vercel

1. Log into [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `Raed22xm/ai-business-operations-platform`.
4. In the configuration screen:
   - **Framework Preset:** Next.js
   - **Root Directory:** Click `Edit` and select `frontend`
5. Expand **Environment Variables** and add:
   - `API_BASE_URL`: Your backend API URL from Step 2 (e.g. `https://aibusiness-api-xxxx.onrender.com`)
   - `AUTH_COOKIE_SECURE`: `true`
   - `NODE_ENV`: `production`
6. Click **Deploy**.

---

## Step 4: Log In and Work From Anywhere!

Once Vercel finishes deploying (usually under 1 minute):
1. Open your live Vercel URL (e.g., `https://ai-business-operations-platform.vercel.app`).
2. Log in with your operator credentials:
   - **Username:** `admin`
   - **Password:** `admin123` (or the password configured in Render)
3. You now have a permanent 24/7 web application accessible from anywhere!
