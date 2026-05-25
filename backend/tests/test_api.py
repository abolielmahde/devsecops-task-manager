from app import create_app, db


def test_health():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "SECRET_KEY": "test"})
    client = app.test_client()
    assert client.get("/api/health").json["status"] == "ok"


def test_register_login_and_task_flow():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "SECRET_KEY": "test"})
    client = app.test_client()

    reg = client.post("/api/auth/register", json={"username": "student", "email": "student@example.com", "password": "Password123!"})
    assert reg.status_code == 201
    token = reg.json["token"]
    headers = {"Authorization": f"Bearer {token}"}

    project = client.post("/api/projects", json={"name": "Security Sprint"}, headers=headers)
    assert project.status_code == 201

    task = client.post("/api/tasks", json={"title": "Add scanning", "project_id": project.json["id"]}, headers=headers)
    assert task.status_code == 201

    tasks = client.get("/api/tasks", headers=headers)
    assert tasks.status_code == 200
    assert tasks.json[0]["title"] == "Add scanning"
