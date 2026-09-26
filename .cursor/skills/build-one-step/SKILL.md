---
name: build-one-step
description: >-
  Builds the AI Business Operations Platform one approved step at a time.
  Use when adding a feature, changing the API, or deciding what to do next
  in this repository.
---

# Build one step

This is a learning project. The learner is new to C# and ASP.NET Core.

## Scope

Version 1 is authentication, customers, cases, tasks, and a dashboard. AI summaries, document upload, search, analytics, and notifications are out of scope until the core platform works.

Do not start the next feature, frontend, auth, Docker changes, or CI unless the user asks for that step.

## How to work

1. Read the current files. Do not trust older chat history.
2. Do only the requested step.
3. Explain the change in beginner language: what was added and why.
4. Run the check that belongs to that step. Never report a check as passed unless it was executed.
5. Stop and wait for approval.

The .NET SDK is `/Users/raed22/.dotnet/dotnet`. The solution file is `backend/AiBusiness.slnx`, not `.sln`.

Do not commit unless the user asks. Do not stop API processes that were already running.
