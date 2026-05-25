import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import jwt
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"txt", "pdf", "png", "jpg", "jpeg", "doc", "docx"}

db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, default="")
    status = db.Column(db.String(30), default="todo", nullable=False)
    priority = db.Column(db.String(20), default="medium", nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    attachment = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-only-change-me")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", "sqlite:///devsecops_local.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

    if test_config:
        app.config.update(test_config)

    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGIN", "*")}})
    db.init_app(app)

    with app.app_context():
        db.create_all()
        # Simple local migration for older SQLite databases created before priority existed.
        if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
            columns = db.session.execute(text("PRAGMA table_info(task)")).fetchall()
            column_names = {column[1] for column in columns}
            if "priority" not in column_names:
                db.session.execute(text("ALTER TABLE task ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'medium'"))
                db.session.commit()

    def token_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "", 1) if auth_header.startswith("Bearer ") else None
            if not token:
                return jsonify({"error": "missing token"}), 401
            try:
                payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
                user = db.session.get(User, payload["sub"])
            except Exception:
                return jsonify({"error": "invalid token"}), 401
            if not user:
                return jsonify({"error": "user not found"}), 401
            return view(user, *args, **kwargs)
        return wrapped

    def create_token(user):
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
            "iat": now,
            "exp": now + timedelta(hours=8),
        }
        return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")

    def allowed_file(filename):
        return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "devsecops-task-manager"})

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if len(username) < 3 or "@" not in email or len(password) < 8:
            return jsonify({"error": "username, valid email and password length >= 8 are required"}), 400
        if User.query.filter((User.username == username) | (User.email == email)).first():
            return jsonify({"error": "username or email already exists"}), 409
        user = User(username=username, email=email, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        return jsonify({"token": create_token(user), "user": {"id": user.id, "username": user.username}}), 201


    @app.post("/api/auth/forgot-password")
    def forgot_password():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        new_password = data.get("new_password") or ""
        if "@" not in email or len(new_password) < 8:
            return jsonify({"error": "valid email and new password length >= 8 are required"}), 400
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "email was not found"}), 404
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({"message": "password was reset successfully"})

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        identifier = (data.get("identifier") or "").strip().lower()
        password = data.get("password") or ""
        user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "invalid credentials"}), 401
        return jsonify({"token": create_token(user), "user": {"id": user.id, "username": user.username}})

    @app.get("/api/projects")
    @token_required
    def list_projects(current_user):
        projects = Project.query.filter_by(owner_id=current_user.id).order_by(Project.created_at.desc()).all()
        return jsonify([{"id": p.id, "name": p.name, "description": p.description} for p in projects])

    @app.post("/api/projects")
    @token_required
    def create_project(current_user):
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "project name is required"}), 400
        project = Project(name=name, description=data.get("description", ""), owner_id=current_user.id)
        db.session.add(project)
        db.session.commit()
        return jsonify({"id": project.id, "name": project.name, "description": project.description}), 201

    @app.get("/api/tasks")
    @token_required
    def list_tasks(current_user):
        tasks = Task.query.filter_by(owner_id=current_user.id).order_by(Task.created_at.desc()).all()
        return jsonify([
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "project_id": t.project_id,
                "attachment": t.attachment,
            }
            for t in tasks
        ])

    @app.post("/api/tasks")
    @token_required
    def create_task(current_user):
        data = request.form if request.form else request.get_json(force=True)
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "task title is required"}), 400
        task = Task(
            title=title,
            description=data.get("description", ""),
            status=data.get("status", "todo"),
            priority=data.get("priority", "medium"),
            project_id=data.get("project_id") or None,
            owner_id=current_user.id,
        )
        file = request.files.get("file")
        if file and file.filename:
            if not allowed_file(file.filename):
                return jsonify({"error": "file type is not allowed"}), 400
            filename = secure_filename(f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}_{file.filename}")
            file.save(UPLOAD_DIR / filename)
            task.attachment = filename
        db.session.add(task)
        db.session.commit()
        return jsonify({"id": task.id, "title": task.title, "status": task.status, "priority": task.priority, "attachment": task.attachment}), 201

    @app.put("/api/tasks/<int:task_id>")
    @token_required
    def update_task(current_user, task_id):
        task = Task.query.filter_by(id=task_id, owner_id=current_user.id).first_or_404()
        data = request.get_json(force=True)
        task.title = data.get("title", task.title)
        task.description = data.get("description", task.description)
        task.status = data.get("status", task.status)
        task.priority = data.get("priority", task.priority)
        db.session.commit()
        return jsonify({"id": task.id, "title": task.title, "description": task.description, "status": task.status, "priority": task.priority})

    @app.delete("/api/tasks/<int:task_id>")
    @token_required
    def delete_task(current_user, task_id):
        task = Task.query.filter_by(id=task_id, owner_id=current_user.id).first_or_404()
        db.session.delete(task)
        db.session.commit()
        return jsonify({"deleted": True})

    @app.get("/api/uploads/<path:filename>")
    @token_required
    def download_upload(current_user, filename):
        safe_name = secure_filename(filename)
        if not safe_name.startswith(f"user_{current_user.id}_"):
            return jsonify({"error": "forbidden"}), 403
        return send_from_directory(UPLOAD_DIR, safe_name, as_attachment=True)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)), debug=False)
