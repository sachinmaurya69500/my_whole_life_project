import base64
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import BytesIO
from urllib import error as url_error
from urllib import request as url_request
from bson import ObjectId
from dotenv import load_dotenv
from flask import (
	Flask,
	Response,
	jsonify,
	redirect,
	render_template,
	request,
	session,
	url_for,
	send_from_directory,
)
from pymongo import MongoClient
from pymongo.errors import ConfigurationError, PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from gridfs import GridFSBucket

if not load_dotenv():
	load_dotenv(".env.example")


def utc_now():
	return datetime.now(timezone.utc)


def parse_iso_or_none(value):
	if not value:
		return None
	try:
		return datetime.fromisoformat(value)
	except ValueError:
		return None


def to_object_id(value):
	try:
		return ObjectId(value)
	except Exception:
		return None


def gemini_api_key_value():
	return (os.getenv("GEMINI_API_KEY") or "").strip()


def gemini_api_key_ready():
	api_key = gemini_api_key_value()
	return bool(api_key) and api_key != "your_gemini_api_key_here"


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-me-in-production")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME")

if not MONGO_URI:
	raise RuntimeError("MONGO_URI is not set. Add your MongoDB Atlas connection string in .env")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
try:
	client.admin.command("ping")
except PyMongoError as exc:
	raise RuntimeError(f"Unable to connect to MongoDB Atlas: {exc}") from exc

if DB_NAME:
	db = client[DB_NAME]
else:
	try:
		db = client.get_default_database()
	except ConfigurationError as exc:
		raise RuntimeError(
			"MONGO_DB_NAME is not set and no default database is present in MONGO_URI."
		) from exc
users_col = db["users"]
workflows_col = db["workflows"]
fs_bucket = GridFSBucket(db)


def login_required(fn):
	@wraps(fn)
	def wrapper(*args, **kwargs):
		if not session.get("user_id"):
			return jsonify({"error": "Unauthorized"}), 401
		return fn(*args, **kwargs)

	return wrapper


def page_login_required(fn):
	@wraps(fn)
	def wrapper(*args, **kwargs):
		if not session.get("user_id"):
			return redirect(url_for("login_page"))
		return fn(*args, **kwargs)

	return wrapper


def workflow_to_json(doc):
	photos = doc.get("photo_file_ids", [])[:1]
	updated_at = doc.get("updated_at")
	# Millisecond version avoids stale browser cache on rapid consecutive updates.
	version = int(updated_at.timestamp() * 1000) if updated_at else 0
	return {
		"_id": str(doc.get("_id")),
		"title": doc.get("title", ""),
		"type": doc.get("type", "Daily"),
		"description": doc.get("description", ""),
		"progress": int(doc.get("progress", 0)),
		"status": doc.get("status", "Not Started"),
		"start_date": doc.get("start_date").date().isoformat() if doc.get("start_date") else "",
		"due_date": doc.get("due_date").date().isoformat() if doc.get("due_date") else "",
		"notes": doc.get("notes", ""),
		"code_snippet": doc.get("code_snippet", ""),
		"additional_details": doc.get("additional_details", ""),
		"photo_urls": [f"/image/{str(photo_id)}?v={version}" for photo_id in photos],
		"photo_ids": [str(photo_id) for photo_id in photos],
		"created_at": doc.get("created_at").isoformat() if doc.get("created_at") else "",
		"updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else "",
	}


def normalize_email(value):
	return (value or "").strip().lower()


def build_workflow_context(limit=10):
	items = list(workflows_col.find({}).sort("updated_at", -1).limit(limit))
	if not items:
		return "No workflows available yet."

	lines = []
	for item in items:
		lines.append(
			f"- {item.get('title', 'Untitled')} | type={item.get('type', 'Daily')} | "
			f"status={item.get('status', 'Not Started')} | progress={int(item.get('progress', 0))}%"
		)
	return "\n".join(lines)



def build_rich_context(limit=15):
	items = list(workflows_col.find({}).sort("updated_at", -1).limit(limit))
	if not items:
		return "No workflows available yet."

	lines = ["Current workflows:"]
	for item in items:
		lines.append(
			f"- {item.get('title', 'Untitled')} | type={item.get('type', 'Daily')} | "
			f"status={item.get('status', 'Not Started')} | progress={int(item.get('progress', 0))}%"
		)
		description = (item.get("description") or "").strip()
		notes = (item.get("notes") or "").strip()
		if description:
			lines.append(f"  description: {description}")
		if notes:
			lines.append(f"  notes: {notes}")

	return "\n".join(lines)


def _extract_gemini_content(response_data):
	candidates = response_data.get("candidates") or []
	if not candidates:
		raise RuntimeError("Gemini API returned an empty response")

	content = candidates[0].get("content") or {}
	parts = content.get("parts") or []
	texts = []
	for part in parts:
		if isinstance(part, dict):
			text = (part.get("text") or "").strip()
			if text:
				texts.append(text)

	result = "\n".join(texts).strip()
	if not result:
		raise RuntimeError("Gemini API did not return message content")
	return result


def _call_gemini_chat_with_model(messages, model, system_instruction):
	if not gemini_api_key_ready():
		raise RuntimeError("GEMINI_API_KEY is not configured on the server")

	api_key = gemini_api_key_value()
	payload = json.dumps(
		{
			"systemInstruction": {"parts": [{"text": system_instruction}]},
			"contents": messages,
			"generationConfig": {"maxOutputTokens": 500, "temperature": 0.3},
		}
	).encode("utf-8")

	request_obj = url_request.Request(
		f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
		data=payload,
		headers={"Content-Type": "application/json"},
		method="POST",
	)

	try:
		with url_request.urlopen(request_obj) as response:
			response_data = json.loads(response.read().decode("utf-8"))
	except url_error.HTTPError as exc:
		error_body = exc.read().decode("utf-8", errors="ignore")
		raise RuntimeError(f"Gemini API request failed: {exc.code} {error_body}") from exc
	except url_error.URLError as exc:
		raise RuntimeError(f"Unable to reach Gemini API: {exc}") from exc

	return _extract_gemini_content(response_data)


def call_gemini_chat(messages, system_instruction):
	model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
	return _call_gemini_chat_with_model(messages, model=model, system_instruction=system_instruction)


def sanitize_chat_history(raw_history, limit=20):
	if not isinstance(raw_history, list):
		return []

	cleaned = []
	for item in raw_history:
		if not isinstance(item, dict):
			continue
		role = (item.get("role") or "").strip().lower()
		content = (item.get("content") or "").strip()
		if role not in {"user", "assistant"}:
			continue
		if not content:
			continue
		cleaned.append({"role": role, "content": content[:4000]})

	if limit <= 0:
		return cleaned
	return cleaned[-limit:]


def get_user_chat_history(user_id, limit=20):
	user = users_col.find_one({"_id": user_id}, {"chat_history": 1})
	if not user:
		return []
	return sanitize_chat_history(user.get("chat_history", []), limit=limit)


def store_chat_turn(user_id, user_message, assistant_message, max_messages=40):
	now_iso = utc_now().isoformat()
	users_col.update_one(
		{"_id": user_id},
		{
			"$push": {
				"chat_history": {
					"$each": [
						{"role": "user", "content": user_message, "created_at": now_iso},
						{"role": "assistant", "content": assistant_message, "created_at": now_iso},
					],
					"$slice": -max_messages,
				}
			},
			"$set": {"updated_at": utc_now()},
		},
	)


def cleanup_legacy_data():
	# Remove legacy fields from old auth implementations.
	users_col.update_many(
		{},
		{"$unset": {"username": ""}},
	)


def ensure_seed_data():
	email = normalize_email(os.getenv("APP_EMAIL"))
	password = os.getenv("APP_PASSWORD") or "123456"
	if not email:
		email = "sachin@example.com"

	user = users_col.find_one({"email": email})
	if not user:
		legacy_user = users_col.find_one({"username": email})
		if legacy_user:
			users_col.update_one(
				{"_id": legacy_user["_id"]},
				{
					"$set": {
						"email": email,
						"password_hash": generate_password_hash(password),
						"updated_at": utc_now(),
					},
					"$unset": {"username": ""},
				},
			)
			user = users_col.find_one({"_id": legacy_user["_id"]})

	if not user:
		user_doc = {
			"email": email,
			"password_hash": generate_password_hash(password),
			"display_name": "Sachin",
			"location": "Haryana",
			"bio": "Focused on building disciplined daily systems and long-term projects.",
			"profile_image_file_id": None,
			"created_at": utc_now(),
			"updated_at": utc_now(),
		}
		inserted = users_col.insert_one(user_doc)
		user = users_col.find_one({"_id": inserted.inserted_id})
	elif not user.get("password_hash"):
		users_col.update_one(
			{"_id": user["_id"]},
			{
				"$set": {
					"password_hash": generate_password_hash(password),
					"updated_at": utc_now(),
				}
			},
		)

	if not user.get("profile_image_file_id"):
		# 1x1 PNG placeholder image for first-time setup.
		tiny_png_b64 = (
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4"
			"//8/AwAI/AL+o6X8VQAAAABJRU5ErkJggg=="
		)
		img_bytes = base64.b64decode(tiny_png_b64)
		file_id = fs_bucket.upload_from_stream(
			"profile-placeholder.png",
			BytesIO(img_bytes),
			metadata={"contentType": "image/png", "owner": str(user["_id"]), "kind": "profile"},
		)
		users_col.update_one(
			{"_id": user["_id"]},
			{"$set": {"profile_image_file_id": file_id, "updated_at": utc_now()}},
		)

	if workflows_col.count_documents({}) == 0:
		sample_workflows = [
			{
				"title": "Morning Planning Ritual",
				"type": "Daily",
				"description": "Review goals and set top 3 priorities.",
				"progress": 85,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-04-01"),
				"due_date": parse_iso_or_none("2026-04-20"),
				"notes": "Keep it under 20 minutes.",
			},
			{
				"title": "Workout + Stretch",
				"type": "Daily",
				"description": "45-minute strength session followed by mobility.",
				"progress": 60,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-02-15"),
				"due_date": parse_iso_or_none("2026-04-20"),
				"notes": "Track consistency in weekly sheet.",
			},
			{
				"title": "DSA Practice",
				"type": "Daily",
				"description": "Solve 2 medium coding problems.",
				"progress": 40,
				"status": "Not Started",
				"start_date": parse_iso_or_none("2026-04-15"),
				"due_date": parse_iso_or_none("2026-04-20"),
				"notes": "Focus on arrays and hashing this week.",
			},
			{
				"title": "Read 20 Pages",
				"type": "Daily",
				"description": "Read from current productivity book.",
				"progress": 100,
				"status": "Completed",
				"start_date": parse_iso_or_none("2026-03-01"),
				"due_date": parse_iso_or_none("2026-04-19"),
				"notes": "Capture 2 actionable insights.",
			},
			{
				"title": "Portfolio Redesign",
				"type": "Long-term",
				"description": "Build modern portfolio with project case studies.",
				"progress": 55,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-04-01"),
				"due_date": parse_iso_or_none("2026-06-15"),
				"notes": "Finalize hero section and project detail pages.",
			},
			{
				"title": "Python Flask Mastery",
				"type": "Long-term",
				"description": "Complete advanced Flask + MongoDB workflows.",
				"progress": 35,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-02-01"),
				"due_date": parse_iso_or_none("2026-07-01"),
				"notes": "Build at least 3 production-style mini apps.",
			},
			{
				"title": "YouTube Learning Series",
				"type": "Long-term",
				"description": "Publish weekly coding tutorials.",
				"progress": 20,
				"status": "Not Started",
				"start_date": parse_iso_or_none("2026-05-01"),
				"due_date": parse_iso_or_none("2026-08-30"),
				"notes": "Plan first 5 scripts in advance.",
			},
			{
				"title": "Savings Goal Tracker",
				"type": "Long-term",
				"description": "Track monthly investment and emergency fund.",
				"progress": 70,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-01-15"),
				"due_date": parse_iso_or_none("2026-12-31"),
				"notes": "Automate monthly summary reminders.",
			},
			{
				"title": "Community Networking",
				"type": "Long-term",
				"description": "Attend 2 dev events per month.",
				"progress": 50,
				"status": "In Progress",
				"start_date": parse_iso_or_none("2026-03-01"),
				"due_date": parse_iso_or_none("2026-09-30"),
				"notes": "Connect with mentors and peers.",
			},
		]
		now = utc_now()
		docs = []
		for item in sample_workflows:
			docs.append(
				{
					**item,
					"photo_file_ids": [],
					"start_date": item.get("start_date"),
					"created_at": now,
					"updated_at": now,
				}
			)
		workflows_col.insert_many(docs)


@app.route("/")
def root():
	if session.get("user_id"):
		return redirect(url_for("home"))
	return redirect(url_for("login_page"))


@app.route("/login", methods=["GET"])
def login_page():
	if session.get("user_id"):
		return redirect(url_for("home"))
	return render_template("login.html")


@app.route("/login", methods=["POST"])
def login_action():
	payload = request.get_json(silent=True) or request.form
	email = normalize_email(payload.get("email"))
	password = payload.get("password") or ""
	configured_email = normalize_email(os.getenv("APP_EMAIL", ""))
	configured_password = os.getenv("APP_PASSWORD", "")

	if not email or not password:
		return jsonify({"error": "Email and password are required"}), 400

	if "@" not in email:
		return jsonify({"error": "Please enter a valid email"}), 400

	user = users_col.find_one({"email": email})
	if not user:
		# Auto-heal the configured app account if DB is empty or inconsistent.
		if configured_email and configured_password and email == configured_email and password == configured_password:
			user_doc = {
				"email": email,
				"password_hash": generate_password_hash(configured_password),
				"display_name": "Sachin",
				"location": "Haryana",
				"bio": "Focused on building disciplined daily systems and long-term projects.",
				"profile_image_file_id": None,
				"created_at": utc_now(),
				"updated_at": utc_now(),
			}
			inserted = users_col.insert_one(user_doc)
			user = users_col.find_one({"_id": inserted.inserted_id})
		else:
			return jsonify({"error": "Account not found"}), 401

	stored_hash = user.get("password_hash", "")
	if not stored_hash:
		# Auto-heal only when hash is missing, not when it is mismatched.
		if configured_email and configured_password and email == configured_email and password == configured_password:
			users_col.update_one(
				{"_id": user["_id"]},
				{"$set": {"password_hash": generate_password_hash(configured_password), "updated_at": utc_now()}},
			)
			user = users_col.find_one({"_id": user["_id"]})
			stored_hash = user.get("password_hash", "") if user else ""
		else:
			return jsonify({"error": "Invalid email or password"}), 401

	if not stored_hash or not check_password_hash(stored_hash, password):
		return jsonify({"error": "Invalid email or password"}), 401

	users_col.update_one({"_id": user["_id"]}, {"$set": {"updated_at": utc_now()}})

	session.permanent = True
	session["user_id"] = str(user["_id"])
	session["email"] = user.get("email", "")
	session["logged_in_at"] = utc_now().isoformat()
	return jsonify({"message": "Login successful"})


@app.route("/logout", methods=["POST"])
def logout_action():
	session.clear()
	return jsonify({"message": "Logged out"})


@app.route("/home")
@page_login_required
def home():
	return render_template("index.html", app_name="Sachin Workflow Manager")


@app.route("/insights", methods=["GET"])
@page_login_required
def insights_page():
	return render_template("insights.html", app_name="Sachin Workflow Manager")


@app.route("/forgot-password", methods=["GET"])
@page_login_required
def forgot_password_page():
	return render_template("forgot_password.html")


@app.route("/project/<workflow_id>", methods=["GET"])
@page_login_required
def project_detail_page(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return redirect(url_for("home"))
	return render_template("project_detail.html", workflow_id=workflow_id, app_name="Sachin Workflow Manager")


@app.route("/api/profile", methods=["GET"])
@login_required
def get_profile():
	user_id = to_object_id(session["user_id"])
	user = users_col.find_one({"_id": user_id})
	if not user:
		return jsonify({"error": "User not found"}), 404

	return jsonify(
		{
			"email": user.get("email", ""),
			"display_name": user.get("display_name", ""),
			"location": user.get("location", ""),
			"bio": user.get("bio", ""),
			"profile_image_url": f"/image/{str(user['profile_image_file_id'])}" if user.get("profile_image_file_id") else "",
			"profile_image_file_id": str(user.get("profile_image_file_id")) if user.get("profile_image_file_id") else "",
			"profile_image_updated_at": user.get("updated_at").isoformat() if user.get("updated_at") else "",
		}
	)


@app.route("/api/profile", methods=["PUT"])
@login_required
def update_profile():
	user_id = to_object_id(session["user_id"])
	payload = request.get_json(silent=True) or {}

	update = {
		"display_name": (payload.get("display_name") or "Sachin").strip(),
		"location": (payload.get("location") or "Haryana").strip(),
		"bio": (payload.get("bio") or "").strip(),
		"updated_at": utc_now(),
	}
	users_col.update_one({"_id": user_id}, {"$set": update})
	return jsonify({"message": "Profile updated"})


@app.route("/api/profile/password", methods=["PUT"])
@login_required
def update_password():
	user_id = to_object_id(session["user_id"])
	payload = request.get_json(silent=True) or {}

	new_password = (payload.get("new_password") or "").strip()
	confirm_password = (payload.get("confirm_password") or "").strip()

	if not new_password or not confirm_password:
		return jsonify({"error": "New password and confirm password are required"}), 400

	if new_password != confirm_password:
		return jsonify({"error": "Passwords do not match"}), 400

	if len(new_password) < 6:
		return jsonify({"error": "Password must be at least 6 characters"}), 400

	users_col.update_one(
		{"_id": user_id},
		{
			"$set": {
				"password_hash": generate_password_hash(new_password),
				"password_updated_at": utc_now(),
				"updated_at": utc_now(),
			}
		},
	)
	return jsonify({"message": "Password updated successfully"})


@app.route("/api/profile/photo", methods=["POST"])
@login_required
def upload_profile_photo():
	user_id = to_object_id(session["user_id"])
	user = users_col.find_one({"_id": user_id})
	if not user:
		return jsonify({"error": "User not found"}), 404

	file = request.files.get("photo")
	if not file:
		return jsonify({"error": "No file uploaded"}), 400

	filename = secure_filename(file.filename or "profile-photo")
	content_type = file.mimetype or "application/octet-stream"
	new_file_id = fs_bucket.upload_from_stream(
		filename,
		file.stream,
		metadata={"contentType": content_type, "owner": str(user_id), "kind": "profile"},
	)

	old_file_id = user.get("profile_image_file_id")
	users_col.update_one(
		{"_id": user_id},
		{"$set": {"profile_image_file_id": new_file_id, "updated_at": utc_now()}},
	)

	removed_previous_image = False
	if old_file_id:
		old_obj_id = old_file_id if isinstance(old_file_id, ObjectId) else to_object_id(str(old_file_id))
		if old_obj_id and old_obj_id != new_file_id:
			try:
				fs_bucket.delete(old_obj_id)
				removed_previous_image = True
			except PyMongoError:
				removed_previous_image = False

	return jsonify(
		{
			"message": "Profile image updated",
			"profile_image_url": f"/image/{str(new_file_id)}",
			"profile_image_file_id": str(new_file_id),
			"stored_in_mongodb": True,
			"removed_previous_image": removed_previous_image,
		}
	)


@app.route("/api/dashboard", methods=["GET"])
@login_required
def dashboard_stats():
	workflows = list(workflows_col.find({}))
	total = len(workflows)
	daily = len([w for w in workflows if w.get("type") == "Daily"])
	long_term = len([w for w in workflows if w.get("type") == "Long-term"])
	avg_progress = round(sum(w.get("progress", 0) for w in workflows) / total, 2) if total else 0

	recent_docs = list(workflows_col.find({}).sort("updated_at", -1).limit(6))
	recent_activity = []
	for item in recent_docs:
		recent_activity.append(
			{
				"title": item.get("title", "Untitled"),
				"status": item.get("status", "Not Started"),
				"progress": item.get("progress", 0),
				"updated_at": item.get("updated_at").isoformat() if item.get("updated_at") else "",
			}
		)

	return jsonify(
		{
			"total": total,
			"daily": daily,
			"long_term": long_term,
			"avg_progress": avg_progress,
			"recent_activity": recent_activity,
		}
	)


@app.route("/api/insights", methods=["GET"])
@login_required
def insights_data():
	workflows = list(workflows_col.find({}).sort("updated_at", 1))

	projects = []
	status_counts = {"Not Started": 0, "In Progress": 0, "Completed": 0}
	daily_stats = {}

	for wf in workflows:
		title = wf.get("title", "Untitled")
		wf_type = wf.get("type", "Daily")
		if wf_type not in {"Daily", "Long-term"}:
			wf_type = "Daily"

		progress = int(wf.get("progress", 0))
		progress = max(0, min(100, progress))

		status = wf.get("status", "Not Started")
		if status not in status_counts:
			status = "Not Started"
		status_counts[status] += 1

		due_date = wf.get("due_date")
		day_source = due_date or wf.get("updated_at") or wf.get("created_at")
		day_label = ""
		if day_source and hasattr(day_source, "date"):
			day_label = day_source.date().isoformat()

		projects.append(
			{
				"title": title,
				"type": wf_type,
				"progress": progress,
				"status": status,
				"day": day_label,
			}
		)

		if day_label:
			if day_label not in daily_stats:
				daily_stats[day_label] = {
					"Daily": {"sum": 0, "count": 0},
					"Long-term": {"sum": 0, "count": 0},
					"all": {"sum": 0, "count": 0},
				}

			daily_stats[day_label][wf_type]["sum"] += progress
			daily_stats[day_label][wf_type]["count"] += 1
			daily_stats[day_label]["all"]["sum"] += progress
			daily_stats[day_label]["all"]["count"] += 1

	labels = sorted(daily_stats.keys())
	daily_progress = []
	long_term_progress = []
	all_progress = []

	for label in labels:
		daily_bucket = daily_stats[label]["Daily"]
		long_bucket = daily_stats[label]["Long-term"]
		all_bucket = daily_stats[label]["all"]

		daily_progress.append(round(daily_bucket["sum"] / daily_bucket["count"], 2) if daily_bucket["count"] else 0)
		long_term_progress.append(round(long_bucket["sum"] / long_bucket["count"], 2) if long_bucket["count"] else 0)
		all_progress.append(round(all_bucket["sum"] / all_bucket["count"], 2) if all_bucket["count"] else 0)

	return jsonify(
		{
			"projects": projects,
			"status_counts": status_counts,
			"daily_trend": {
				"labels": labels,
				"daily": daily_progress,
				"long_term": long_term_progress,
				"all": all_progress,
			},
		}
	)


@app.route("/api/ai-chat/status", methods=["GET"])
def ai_chat_status():
	return jsonify(
		{
			"provider": "gemini",
			"api_key_configured": gemini_api_key_ready(),
			"authenticated": bool(session.get("user_id")),
			"ready": gemini_api_key_ready() and bool(session.get("user_id")),
		}
	)


@app.route("/api/ai-chat", methods=["POST"])
@login_required
def ai_chat():
	user_id = to_object_id(session["user_id"])
	if not user_id:
		return jsonify({"error": "Unauthorized"}), 401

	payload = request.get_json(silent=True) or {}
	user_message = (payload.get("message") or "").strip()

	if not user_message:
		return jsonify({"error": "Message is required"}), 400
	if len(user_message) > 1500:
		return jsonify({"error": "Message is too long"}), 400

	chat_history = get_user_chat_history(user_id, limit=16)
	workflow_context = build_rich_context(limit=15)

	system_prompt = (
		"You are a productivity assistant for Sachin's workflow manager app. "
		"Give concise, practical advice focused on priorities, scheduling, and execution. "
		"Use the workflow context when relevant."
	)
	system_instruction = f"{system_prompt}\n\n{workflow_context}"

	messages = []
	for item in chat_history:
		messages.append(
			{
				"role": "user" if item.get("role") == "user" else "model",
				"parts": [{"text": item.get("content", "")}],
			}
		)
	messages.append({"role": "user", "parts": [{"text": user_message}]})

	try:
		reply = call_gemini_chat(messages, system_instruction=system_instruction)
	except RuntimeError as exc:
		message = str(exc)
		if "GEMINI_API_KEY" in message:
			return jsonify({"error": "Gemini chat is not configured on the server"}), 503
		if "Gemini API request failed: 400" in message:
			return jsonify({"error": "Invalid Gemini model or request", "details": message}), 400
		if "Gemini API request failed: 401" in message or "Gemini API request failed: 403" in message:
			return jsonify({"error": "Gemini authentication/permission error", "details": message}), 403
		return jsonify({"error": "AI service is temporarily unavailable", "details": message}), 502

	store_chat_turn(user_id, user_message, reply)

	return jsonify({"reply": reply})


@app.route("/api/ai-chat/history", methods=["GET"])
@login_required
def ai_chat_history():
	user_id = to_object_id(session["user_id"])
	if not user_id:
		return jsonify({"error": "Unauthorized"}), 401

	history = get_user_chat_history(user_id, limit=40)
	return jsonify({"messages": history})


@app.route("/api/workflows", methods=["GET"])
@login_required
def list_workflows():
	wf_type = request.args.get("type", "").strip()
	q = request.args.get("q", "").strip()

	mongo_query = {}
	if wf_type in {"Daily", "Long-term"}:
		mongo_query["type"] = wf_type
	if q:
		mongo_query["$or"] = [
			{"title": {"$regex": q, "$options": "i"}},
			{"description": {"$regex": q, "$options": "i"}},
			{"notes": {"$regex": q, "$options": "i"}},
			{"status": {"$regex": q, "$options": "i"}},
		]

	docs = list(workflows_col.find(mongo_query).sort("updated_at", -1))
	return jsonify([workflow_to_json(doc) for doc in docs])


@app.route("/api/workflows", methods=["POST"])
@login_required
def create_workflow():
	data = request.get_json(silent=True) or {}

	title = (data.get("title") or "").strip()
	wf_type = (data.get("type") or "Daily").strip()
	description = (data.get("description") or "").strip()
	notes = (data.get("notes") or "").strip()
	status = (data.get("status") or "Not Started").strip()
	progress = int(data.get("progress") or 0)
	start_date = parse_iso_or_none(data.get("start_date") or "")
	due_date = parse_iso_or_none(data.get("due_date") or "")

	if not title:
		return jsonify({"error": "Title is required"}), 400
	if wf_type not in {"Daily", "Long-term"}:
		return jsonify({"error": "Invalid workflow type"}), 400
	if status not in {"Not Started", "In Progress", "Completed"}:
		return jsonify({"error": "Invalid status"}), 400
	if progress < 0 or progress > 100:
		return jsonify({"error": "Progress must be between 0 and 100"}), 400

	now = utc_now()
	doc = {
		"title": title,
		"type": wf_type,
		"description": description,
		"progress": progress,
		"status": status,
		"start_date": start_date,
		"due_date": due_date,
		"notes": notes,
		"code_snippet": (data.get("code_snippet") or "").strip(),
		"additional_details": (data.get("additional_details") or "").strip(),
		"photo_file_ids": [],
		"created_at": now,
		"updated_at": now,
	}
	result = workflows_col.insert_one(doc)
	created = workflows_col.find_one({"_id": result.inserted_id})
	return jsonify(workflow_to_json(created)), 201


@app.route("/api/workflows/<workflow_id>", methods=["GET"])
@login_required
def get_workflow(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	return jsonify(workflow_to_json(wf))


@app.route("/api/workflows/<workflow_id>", methods=["PUT"])
@login_required
def update_workflow(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	data = request.get_json(silent=True) or {}
	update_payload = {}

	if "title" in data:
		title = (data.get("title") or "").strip()
		if not title:
			return jsonify({"error": "Title cannot be empty"}), 400
		update_payload["title"] = title

	if "type" in data:
		wf_type = (data.get("type") or "").strip()
		if wf_type not in {"Daily", "Long-term"}:
			return jsonify({"error": "Invalid workflow type"}), 400
		update_payload["type"] = wf_type

	if "description" in data:
		update_payload["description"] = (data.get("description") or "").strip()

	if "notes" in data:
		update_payload["notes"] = (data.get("notes") or "").strip()

	if "code_snippet" in data:
		update_payload["code_snippet"] = (data.get("code_snippet") or "").strip()

	if "additional_details" in data:
		update_payload["additional_details"] = (data.get("additional_details") or "").strip()

	if "status" in data:
		status = (data.get("status") or "").strip()
		if status not in {"Not Started", "In Progress", "Completed"}:
			return jsonify({"error": "Invalid status"}), 400
		update_payload["status"] = status

	if "progress" in data:
		try:
			progress = int(data.get("progress"))
		except Exception:
			return jsonify({"error": "Invalid progress value"}), 400
		if progress < 0 or progress > 100:
			return jsonify({"error": "Progress must be between 0 and 100"}), 400
		update_payload["progress"] = progress

	if "start_date" in data:
		update_payload["start_date"] = parse_iso_or_none(data.get("start_date") or "")

	if "due_date" in data:
		update_payload["due_date"] = parse_iso_or_none(data.get("due_date") or "")

	if not update_payload:
		return jsonify({"error": "No valid fields provided"}), 400

	update_payload["updated_at"] = utc_now()
	workflows_col.update_one({"_id": obj_id}, {"$set": update_payload})
	updated = workflows_col.find_one({"_id": obj_id})
	if not updated:
		return jsonify({"error": "Workflow not found"}), 404
	return jsonify(workflow_to_json(updated))


@app.route("/api/workflows/<workflow_id>", methods=["DELETE"])
@login_required
def delete_workflow(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	for photo_id in wf.get("photo_file_ids", []):
		try:
			fs_bucket.delete(photo_id)
		except Exception:
			pass

	workflows_col.delete_one({"_id": obj_id})
	return jsonify({"message": "Workflow deleted"})


@app.route("/api/workflows/<workflow_id>/photos", methods=["POST"])
@login_required
def upload_workflow_photos(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	file = request.files.get("photo")
	if not file:
		fallback_files = request.files.getlist("photos")
		file = fallback_files[0] if fallback_files else None

	if not file:
		return jsonify({"error": "No file uploaded"}), 400

	content_type = file.mimetype or "application/octet-stream"
	if not content_type.startswith("image/"):
		return jsonify({"error": "Only image files are allowed"}), 400

	file_bytes = file.read()
	if not file_bytes:
		return jsonify({"error": "Uploaded file is empty"}), 400

	filename = secure_filename(file.filename or "workflow-photo")
	photo_sha256 = hashlib.sha256(file_bytes).hexdigest()
	new_file_id = fs_bucket.upload_from_stream(
		filename,
		BytesIO(file_bytes),
		metadata={
			"contentType": content_type,
			"workflow_id": str(obj_id),
			"kind": "workflow",
			"sha256": photo_sha256,
		},
	)

	old_photo_ids = wf.get("photo_file_ids", [])
	workflows_col.update_one(
		{"_id": obj_id},
		{"$set": {"photo_file_ids": [new_file_id], "updated_at": utc_now()}},
	)

	for old_id in old_photo_ids:
		if old_id == new_file_id:
			continue
		try:
			fs_bucket.delete(old_id)
		except Exception:
			pass

	updated = workflows_col.find_one({"_id": obj_id})
	if not updated:
		return jsonify({"error": "Please upload valid image files"}), 400
	return jsonify(workflow_to_json(updated))


@app.route("/api/workflows/<workflow_id>/photos/<photo_id>", methods=["DELETE"])
@login_required
def delete_workflow_photo(workflow_id, photo_id):
	obj_id = to_object_id(workflow_id)
	p_id = to_object_id(photo_id)
	if not obj_id or not p_id:
		return jsonify({"error": "Invalid id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	workflows_col.update_one(
		{"_id": obj_id},
		{"$pull": {"photo_file_ids": p_id}, "$set": {"updated_at": utc_now()}},
	)
	try:
		fs_bucket.delete(p_id)
	except Exception:
		pass

	updated = workflows_col.find_one({"_id": obj_id})
	return jsonify(workflow_to_json(updated))


@app.route("/api/workflows/<workflow_id>/advice", methods=["PUT"])
@login_required
def update_workflow_advice(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	data = request.get_json(silent=True) or {}
	advice = (data.get("advice") or "").strip()

	workflows_col.update_one(
		{"_id": obj_id},
		{
			"$set": {
				"advice": advice,
				"updated_at": utc_now(),
			}
		},
	)

	updated = workflows_col.find_one({"_id": obj_id})
	return jsonify(workflow_to_json(updated))


@app.route("/api/workflows/<workflow_id>/advice", methods=["GET"])
@login_required
def get_workflow_advice(workflow_id):
	obj_id = to_object_id(workflow_id)
	if not obj_id:
		return jsonify({"error": "Invalid workflow id"}), 400

	wf = workflows_col.find_one({"_id": obj_id})
	if not wf:
		return jsonify({"error": "Workflow not found"}), 404

	return jsonify({"advice": wf.get("advice", "")})


@app.route("/image/<file_id>")
def serve_image(file_id):
	obj_id = to_object_id(file_id)
	if not obj_id:
		return jsonify({"error": "Invalid file id"}), 400

	try:
		stream = fs_bucket.open_download_stream(obj_id)
	except PyMongoError:
		return jsonify({"error": "Image not found"}), 404

	data = stream.read()
	metadata = stream.metadata or {}
	content_type = metadata.get("contentType", "application/octet-stream")
	return Response(data, mimetype=content_type)


@app.route("/favicon.ico")
def favicon():
	return send_from_directory(os.path.join(app.root_path, "static"), "favicon.svg", mimetype="image/svg+xml")


ensure_seed_data()
cleanup_legacy_data()


if __name__ == "__main__":
	app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
