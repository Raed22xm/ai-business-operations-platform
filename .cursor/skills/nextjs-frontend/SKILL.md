---
name: nextjs-frontend
description: >-
  Guides the Next.js frontend for the AI Business Operations Platform. Use
  when editing the frontend app, login pages, or calls from the browser to
  the ASP.NET API.
---

# Next.js frontend

The frontend is `frontend/`, created with the App Router, TypeScript, and Tailwind. It is still the starter app. Do not build pages unless the user asks for that step.

This Next.js version uses `proxy.ts` for request interception, not `middleware.ts`. Read `frontend/node_modules/next/dist/docs/` before writing frontend code.

The API is a separate ASP.NET process. Do not move customer storage into Next.js. The browser should call the existing `/api/customers` endpoints.
