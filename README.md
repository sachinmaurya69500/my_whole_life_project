# Sachin Workflow Manager

Production-style Flask + MongoDB + GridFS workflow management web app.

## Features

- Session-based login for Sachin using email and password
- Profile section with image upload to GridFS
- Dashboard stats: Total, Daily, Long-term, Average Progress
- Daily and Long-term project views with progress cards
- Manage workflows admin table with search and inline quick edits
- Add/Edit/Delete workflows via REST-style API and fetch()
- xAI chatbot assistant integrated on dashboard
- Chat memory persisted per user and auto-loaded on dashboard
- Multiple workflow photo uploads to GridFS
- Image serving route: `/image/<file_id>`
- Seed data: 8+ workflows and default profile image

## Project Structure

- `app.py` - Flask app, API routes, GridFS handling, data seeding
- `requirements.txt` - Python dependencies
- `.env.example` - Environment variables template
- `templates/base.html` - Base Jinja layout
- `templates/login.html` - Login page
- `templates/index.html` - Main app UI
- `static/css/style.css` - Custom styles
- `static/js/script.js` - Frontend app logic

## 1) Install Dependencies

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 2) Configure MongoDB Atlas

1. Create a MongoDB Atlas cluster.
2. Create a database user and password.
3. In Network Access, allow your machine IP (or `0.0.0.0/0` for development only).
4. Copy the Atlas connection string and replace placeholders.

## 3) Configure Environment

1. Copy `.env.example` to `.env`
2. Edit values if needed:

```env
FLASK_DEBUG=true
SECRET_KEY=change-this-secret-key
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/sachin_workflow_manager?retryWrites=true&w=majority
MONGO_DB_NAME=sachin_workflow_manager
APP_EMAIL=sachin@example.com
APP_PASSWORD=123456
XAI_API_KEY=your_xai_api_key_here
XAI_MODEL=grok-3-mini
XAI_FALLBACK_MODEL=grok-3-mini
XAI_TIMEOUT_SECONDS=30
```

Notes:

- If your Atlas URI already includes a database name (for example `/sachin_workflow_manager`), `MONGO_DB_NAME` is optional.
- If URI has no database segment, set `MONGO_DB_NAME` explicitly.

Login behavior:

- `APP_EMAIL` is the only allowed login email (single-user mode).
- The user record is fetched from MongoDB by email.
- The entered password is verified against a secure password hash stored in MongoDB.
- `XAI_API_KEY` is required to enable dashboard AI assistant.
- `XAI_MODEL` is optional (default: `grok-3-mini`).
- `XAI_FALLBACK_MODEL` is used automatically if the primary model fails.
- `XAI_TIMEOUT_SECONDS` controls xAI request timeout (default: `30`).

## 4) Run the App

```bash
python app.py
```

Open:

- `http://127.0.0.1:5000/login`

Default login:

- Email: value from `APP_EMAIL`
- Password: value from `APP_PASSWORD`

## 5) API Endpoints

- `POST /login`
- `POST /logout`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/profile/photo`
- `GET /api/dashboard`
- `GET /api/workflows`
- `POST /api/workflows`
- `PUT /api/workflows/<workflow_id>`
- `DELETE /api/workflows/<workflow_id>`
- `POST /api/ai-chat`
- `GET /api/ai-chat/history`
- `POST /api/workflows/<workflow_id>/photos`
- `DELETE /api/workflows/<workflow_id>/photos/<photo_id>`
- `GET /image/<file_id>`

## Notes

- `ensure_seed_data()` auto-creates default user and sample workflows at startup.
- Images are stored directly in MongoDB using `GridFSBucket`.
- For production, set `FLASK_DEBUG=false` and use a strong `SECRET_KEY`.#