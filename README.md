🧩 Auto-Advertisement Platform — Development Roadmap & Future Features
Overview

The Auto-Advertisement Platform automatically generates high-quality marketing assets (text + images) for products using AI.
It integrates:

Firebase (Firestore + Storage) for user/business data.

FastAPI/Node.js backend for image generation and workflow orchestration.

n8n automations for workflow chaining and scheduling.

OpenAI (DALL·E 3) for creative ad image generation.

The system already supports automatic image generation from product data and AI-optimized prompts.
This document outlines all upcoming features, architecture upgrades, and design goals for the full-scale platform.

⚙️ 1. Database Structure Optimization
Current State

Products are stored under /businesses/{businessId}/products/{productId}.

Each product includes fields like Name, Price, Description, ImageUrl, imagePrompt, advertisementText, and generatedImageUrl.

Future Directionמ

Move toward a user-centric hierarchy:

/users/{uid}/businesses/{businessId}/products/{productId}

Rationale

Keeps ownership clear (every business is tied to a user).

Simplifies authentication, billing, and analytics.

Scales naturally to support multiple businesses per user.

Planned Additions

Add createdAt, updatedAt, isEnriched, isPosted, and postDate fields consistently.

Introduce businesses_index collection for global querying and analytics.

Store product images under /users/{uid}/businesses/{businessId}/products/{productId}/ for consistent organization.

🧠 2. User & Business Management
Objective

Introduce a lightweight user system allowing login, profile management, and linking businesses to users.

Features

Google Sign-In (Firebase Auth) for instant user onboarding.

Each user can manage one or multiple businesses.

Business profiles include:

Name, description, phone, address, website, logo, industry tags.

Used as metadata when generating product ads or business-wide campaigns.

Future Considerations

Role-based access (Owner / Editor) for multi-user business accounts.

Business analytics dashboard (ad performance, generated content stats).

💾 3. Product Management Dashboard
Goal

Provide an intuitive web interface for businesses to:

Add and edit products manually.

Upload product images directly.

View and manage generated ads.

Components

Product Table View: shows product name, image, and ad status.

Add Product Form: includes fields used by the GPT prompt (name, price, description, etc.).

Image Upload UI: uses Firebase Storage directly.

Generate Ad Button: triggers backend /generate-ad-image endpoint for a single product.

Future Enhancements

Bulk product import via CSV/XLSX.

“Generate All” button for batch processing.

Smart filters (show only unenriched products).

🤖 4. AI Prompt & Workflow Refinement
Objective

Make AI prompt generation context-aware and visually optimized.

Key Principles

The prompt dynamically adapts based on product type:

Clothing → model wearing product in a fashion shoot.

Accessories → luxury or lifestyle scenes.

Tech → clean modern product photography.

Food/Cosmetics → bright premium packaging imagery.

Always use uploaded product image as reference (not via URL).

Maintain strict output format (JSON with advertisementText and imagePrompt only).

Future Upgrades

Add brand-style customization per business (tone, colors, aesthetic).

AI prompt memory for consistent branding across all ads.

GPT-4 Vision integration for smarter image understanding and styling recommendations.

🧩 5. Automation & Workflow Integration (n8n)
Purpose

Automate the flow from data submission to final asset generation.

Workflow Concept

Trigger: Product added or updated.

Step 1: Generate AI prompt and ad text.

Step 2: Send request to /generate-ad-image backend endpoint.

Step 3: Upload generated image to Firebase Storage.

Step 4: Update Firestore with generatedImageUrl.

Step 5: Send confirmation email or notification to the business owner.

Future Enhancements

Retry mechanism for failed image generations.

Queuing system for batch product handling.

Daily job scheduler for auto-generating new ads.

💳 6. Pricing, Payments & Subscription Plans
Objective

Introduce tiered pricing based on AI usage and generation limits.

Future Architecture

Stripe Billing Integration:

Free tier → limited product generations per month.

Paid tiers → unlock more products, priority queue, premium templates.

Store billing state in Firestore under each user.

Connect Stripe webhooks to backend to enable/disable premium features dynamically.

Long-Term Goals

Credit-based system (1 generation = 1 credit).

In-app subscription management (mobile & web).

Optional pay-per-generation model.

🖥️ 7. Frontend App (React Native / Expo Web)
Concept

Start with a web app that runs in Expo Go, later deploy as mobile app (Android/iOS).

Core Screens

Sign-In Page – Google Auth.

Dashboard – shows user’s businesses.

Business Form – edit business details and upload logo.

Product Table – list, add, and manage products.

Product Form Modal – upload image, fill fields.

Generate Ad Button – triggers AI flow and shows results.

Future Features

Live preview of generated ads.

Multi-language ad support.

“Smart Suggestions” panel for improving ad copy.

🚀 8. Server Scaling & Reliability
Current State

Single-instance backend hosted on VPS with Docker.

Planned Improvements

Reverse Proxy (NGINX) for load balancing and HTTPS.

Horizontal Scaling with Docker Swarm or Kubernetes.

Job Queue / Rate Limiter to handle high-volume AI calls safely.

Monitoring & Logging:

Centralized logs (pino or Winston).

Error tracking via Sentry.

Request metrics dashboard (Prometheus + Grafana).

Long-Term Plan

Auto-scaling infrastructure based on workload.

Multi-region replication for low latency.

API gateway for managing rate limits per user or plan.

🔐 9. Security & Access Control
Planned Features

Firebase Auth for user identity.

Firestore & Storage rules restricting access to user-owned data.

Role-based permissions (Owner / Admin / Staff).

Secure API key handling for backend and n8n integrations.

Audit logging for all product generations.

💬 10. Future AI Enhancements
Advanced Capabilities

Auto-caption translations (multi-language ad variants).

AI scene suggestions based on existing ads.

Ad performance predictions via fine-tuned models.

Template consistency learning (e.g., brand-specific color palettes).

Research Tracks

Integrate Gemini 2.0 for advanced visual understanding.

Add CLIP-based similarity scoring for visual quality control.

Custom diffusion fine-tuning for brand-specific imagery.

🧾 Summary of Priorities
Priority	Feature	Status
✅	Working AI ad image generation (DALL·E 3 + backend)	Complete
🟨	New Firestore structure under /users/{uid}/businesses/...	Planned
🟨	Simple frontend UI (Expo Web) with Google sign-in	Planned
🟨	Product dashboard + upload form	Planned
🟨	Auto workflow in n8n	Planned
⏳	Billing and subscription logic	Future
⏳	Server scaling & monitoring setup	Future
⏳	Multi-language + brand consistency AI features	Future
🧭 Long-Term Vision

To become a plug-and-play AI marketing suite for small businesses:

Businesses upload products → AI generates ads, visuals, and captions automatically.

Everything lives under one ecosystem — text, visuals, posting, analytics, and scheduling.

Scalable, fully automated, and accessible from web or mobile.

End of Document
Version: 1.0.0 — October 2025
Author: Auto-Advertisement Project Team