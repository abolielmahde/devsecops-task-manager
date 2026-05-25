# DevSecOps Task Manager

A complete academic DevSecOps project that demonstrates a real software development workflow: React frontend, Python Flask backend API, PostgreSQL database, Docker, GitHub teamwork, CI/CD, security scans and Terraform infrastructure template.

## What the system includes

- React frontend dashboard
- Flask backend REST API
- PostgreSQL database
- User register/login
- JWT authentication
- Project management
- Task management
- File upload to local storage
- Dockerfiles and Docker Compose
- GitHub Actions CI/CD pipeline
- Security scanning: Bandit, npm audit, Gitleaks and Trivy
- Terraform AWS EC2 example
- Documentation and PlantUML diagrams

## Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend health check: http://localhost:5001/api/health

## Run without Docker

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY="local-dev-secret"
export DATABASE_URL="sqlite:///local.db"
python app.py
```

Backend runs at http://localhost:5001.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Run tests

```bash
cd backend
pytest -q
```

## Suggested Git workflow

```bash
git checkout -b dev
git checkout -b feature/backend-auth
# commit work
git push -u origin feature/backend-auth
# open Pull Request into dev
```

Keep module commits separate, for example backend auth, backend tasks, frontend dashboard, Docker, CI/CD and documentation.

## Security notes

- Do not commit `.env` files.
- Use `.env.example` only as a template.
- Replace `SECRET_KEY` in production.
- Restrict EC2 firewall rules to your own IP.
- Review GitHub Actions scan results before merging PRs.

## Project structure

```text
backend/              Flask API, models, tests, Dockerfile
frontend/             React frontend, Dockerfile, Nginx config
.github/workflows/    CI/CD and security scanning pipeline
infra/terraform/      AWS EC2 infrastructure template
docs/                 Features, use cases, security report and UML diagrams
docker-compose.yml    Local full-stack environment
```
