# Smart Student Hub

Smart Student Hub (SSH) is a student profile and placement-readiness portal. This implementation focuses on the student experience, faculty-reviewed certificate verification, private resume analysis, and student-controlled digital portfolios. Additional role-protected faculty verification decisions are available as an API integration point; other role portals are not part of this version.

## Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS 4, Lucide icons
- API: Node.js, Express, Zod
- Data: MongoDB with Mongoose
- Authentication: bcrypt password hashes and an HttpOnly, SameSite cookie with a signed JWT
- Resume analysis: server-side Cloudflare Workers AI API and PDF text extraction

## Requirements

- Node.js 20 or newer (and npm)
- MongoDB 6 or newer, running locally or hosted
- A Cloudflare account and Workers AI API token for actual resume analysis; profile and other portal features work without it

## Local setup

From the project root:

```powershell
npm install
npm install --prefix server
npm install --prefix client
Copy-Item server\.env.example server\.env
```

Set `JWT_SECRET` in `server\.env` to a unique, randomly generated secret of at least 32 characters. Set `MONGODB_URI` to the development MongoDB connection string. Do not commit `.env` files or production credentials.

Start MongoDB, then start the API and frontend together:

```powershell
npm run dev
```

The frontend is served at http://localhost:5173 and the API at http://localhost:4000. Alternatively, start the processes individually:

```powershell
npm run dev --prefix server
npm run dev --prefix client
```

Create a student account at `/register`. Registration grants only the student role; the application does not expose a client-side role-selection mechanism. Registration should be restricted to institution-approved email domains before production use.

## Environment variables

The example configuration is in [`server/.env.example`](./server/.env.example).

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | API port; defaults to `4000`. |
| `CLIENT_URL` | No | Allowed frontend origin; defaults to `http://localhost:5173`. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Random session-signing secret, minimum 32 characters. |
| `CLOUDFLARE_ACCOUNT_ID` | No | Cloudflare account ID for Workers AI. |
| `CLOUDFLARE_API_TOKEN` | No | Server-side Cloudflare API token with Workers AI access. Analysis returns a clear configuration error if credentials are unset. |
| `CLOUDFLARE_MODEL` | No | Workers AI model; defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. |
| `UPLOAD_DIR` | No | Legacy private PDF storage directory for existing filesystem-backed files; new resumes and certificates are stored in MongoDB. Defaults to `./uploads` locally and `/tmp/uploads` on Vercel. |
| `VITE_API_URL` | No | Optional absolute API origin for a separately hosted frontend. Vite proxies `/api` locally. |

## Features

- Student registration, secure sign-in/out, role-guarded routes, and password changes.
- Dashboard statistics and profile-completion calculation derived from the student's MongoDB records.
- Editable professional and academic profile (including semester SGPA), private profile pictures cropped with a square grid editor and stored with the MongoDB profile for persistence, skills, projects, internships, and secure PDF resume upload/download.
- Achievement drafts and submissions with server-controlled verification state, private PDF certificates, status history, and faculty feedback.
- Faculty-only pending-request, private certificate-access, and verification decision endpoints. There is no faculty-facing review portal in this version, and faculty cannot verify their own achievement.
- Resume analysis against a manual job description with server-side PDF text extraction, email/phone redaction, structured response validation, saved per-student history, and an evidence-based score (60% demonstrated required skills, 40% demonstrated responsibilities). No mocked AI analysis is returned.
- A separate, role-neutral ATS resume checker with a conservative 100-point heuristic score, four evidence-based score dimensions, prioritized actionable findings, and saved private review history. Section headings earn partial credit; impact credit considers bullet volume, action-led wording, and measurable outcomes where relevant. It works for technical and non-technical resumes without requiring a job description; it cannot guarantee a pass in any specific employer's ATS.
- Profile activity heatmaps for public GitHub contributions and LeetCode submissions over the last 365 days. Each provider is fetched independently and cached for 15 minutes.
- Unique public portfolio, explicit visibility and disclosure controls, verified achievement badges, and optional explicit resume download.
- Persistent per-user notifications and account/privacy settings.

## API overview

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `PUT /api/auth/password`
- Student: `/api/student/dashboard`, `/api/student/profile`, `/api/student/projects`, `/api/student/achievements`, `/api/student/verifications`, `/api/student/resume`, `/api/student/resume/analyze`, `/api/student/resume/analyses`, `/api/student/resume/ats-check`, `/api/student/resume/ats-reviews`, `/api/student/portfolio`, `/api/student/notifications`
- Student coding activity: `GET /api/student/profile/activity` reads the authenticated student's saved GitHub profile URL and LeetCode username.
- Faculty: `GET /api/faculty/verifications`, `GET /api/faculty/achievements/:id/certificate`, and `POST /api/faculty/achievements/:id/decision` (requires an authenticated server-side `faculty` role)
- Public: `GET /api/public/portfolios/:slug`, `GET /api/public/portfolios/:slug/resume` (resume route only returns a file if public visibility and the student's explicit resume-download setting are both enabled)
- Health: `GET /api/health`

All authenticated routes derive ownership from the HttpOnly session cookie. Password changes invalidate other active sessions. The student API exposes no verification approval action. Resumes and certificates are stored as private MongoDB binary data so they remain available across Vercel function instances; older filesystem-backed records are supported as a migration fallback. Resumes and certificates are restricted to PDFs of 5 MB or less, and their PDF signature is checked server-side. Profile photos are limited to 2 MB and JPEG, PNG or WebP signatures are checked. Scanned/image-only PDFs require OCR, which is not included.

## Checks

```powershell
npm test --prefix server
npm run build --prefix client
```

The test suite verifies activity calendar parsing, resume match-score methodology, protected student and faculty APIs rejecting anonymous requests, and file-content validation. Mongo-backed integration tests, AI-provider tests with a configured account, and end-to-end browser tests require running MongoDB and provider credentials.

## Privacy and production notes

- Resumes and certificates contain personal information. Sanitized resume text is sent to Cloudflare Workers AI only after the student initiates a job-match analysis or ATS check. Email and phone patterns are removed first; the submitted job description and necessary resume text are otherwise sent to Cloudflare. Review Cloudflare's retention and privacy terms before enabling the integration.
- Coding activity heatmaps use public GitHub and LeetCode profile activity. The LeetCode username is used only for the authenticated student's activity endpoint and is not included in public portfolios. Provider rate limits and upstream changes may temporarily make either heatmap unavailable.
- AI feedback is advisory, provider-dependent, and may be wrong. The percentage is a profile-alignment estimate rather than a probability of hiring.
- Private files are accessible only through authenticated owner routes unless the student deliberately enables the public-portfolio resume download.
- Portfolio endpoints return a curated projection, not the underlying student or academic record.
- Restrict self-service registration to approved student domains or replace it with the institution's identity provider before production.
- Provide institution-managed account provisioning and ensure the MongoDB user roles are assigned through a trusted administrative workflow. No faculty, recruiter, placement-officer, or admin user-management interface is implemented.
- Use HTTPS in production, set `NODE_ENV=production`, provide a strong secret and managed MongoDB, and configure `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in the Vercel Production environment.
- Enable institution-specific consent, retention, backup, audit, account recovery, and privacy-policy workflows before deployment with real student records.

## Vercel deployment

The root [`vercel.json`](./vercel.json) defines the Vite client and Express server as services. `/api/*` is routed to the server and all other paths are routed to the client. Configure the required production environment variables in Vercel before deploying. MongoDB must allow connections from Vercel, and `CLIENT_URL` should match the deployed client origin. Uploaded resumes, certificates, and profile images are persisted in MongoDB; `/tmp` is used only for request-scoped PDF processing.

## Suggested commits

- `feat: build secure Smart Student Hub student portal`
- `feat: add evidence-based resume analyzer and public portfolios`
