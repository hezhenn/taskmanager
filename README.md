# ✅ Task Manager API

A RESTful API for task management built with **Django REST Framework**, **PostgreSQL**, and **Docker**. Features JWT authentication, ownership-based permissions, advanced filtering, and full OpenAPI documentation.

---

## 🛠️ Tech Stack

### Backend
<p>
  <img src="https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Django-5.2-092E20?style=flat-square&logo=django" alt="Django">
  <img src="https://img.shields.io/badge/Django%20REST%20Framework-API-red?style=flat-square" alt="DRF">
  <img src="https://img.shields.io/badge/SimpleJWT-Authentication-yellowgreen?style=flat-square" alt="JWT">
  <img src="https://img.shields.io/badge/django--filter-Filtering-lightgrey?style=flat-square" alt="django-filter">
</p>

### Database & Docs
<p>
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/drf--spectacular-OpenAPI%203.0-informational?style=flat-square" alt="drf-spectacular">
  <img src="https://img.shields.io/badge/Swagger-UI-85EA2D?style=flat-square&logo=swagger&logoColor=black" alt="Swagger">
</p>

### Infrastructure & Testing
<p>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/pytest-Testing-0A9EDC?style=flat-square&logo=pytest&logoColor=white" alt="pytest">
</p>

---

## ✨ Overview

**Task Manager API** is a backend service built to practice production-style Django development: clean project structure, token-based authentication, permission-based data access, automated testing, and containerized deployment.

The project was built as a portfolio piece to demonstrate:

- REST API design with Django REST Framework
- JWT authentication and secure endpoint protection
- Ownership-based access control (users can only manage their own data)
- Filtering, searching, and pagination on API resources
- Automated testing with `pytest`
- OpenAPI documentation with Swagger and Redoc
- Multi-service orchestration with Docker Compose

---

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#️-architecture)
- [Project Structure](#-project-structure)
- [Requirements](#-requirements)
- [Environment Variables](#-environment-variables)
- [Running the Project](#-running-the-project)
- [Running Tests](#-running-tests)
- [API Endpoints](#-api-endpoints)
- [Example API Usage](#-example-api-usage)
- [Possible Improvements](#-possible-improvements)
- [What I Practiced](#-what-i-practiced)
- [Author](#-author)

---

## 🚀 Features

- **Authentication & Profiles**
  - JWT authentication (`access` & `refresh` tokens)
  - User registration with password validation
  - Authenticated profile retrieval and update
- **Task Management**
  - Full CRUD operations on tasks
  - Ownership-based permissions — users only access their own tasks
  - Task statuses: `TODO`, `IN_PROGRESS`, `DONE`
  - Task priorities: `LOW`, `MEDIUM`, `HIGH`
  - Optional due dates
  - Task analytics and statistics (`/api/v1/tasks/statistics/`)
- **Filtering, Search & Pagination**
  - Filter by status, priority, and due date range
  - Full-text search across title and description
  - Ordering by due date, priority, creation date, or title
  - Page-number pagination
- **Documentation**
  - OpenAPI 3.0 schema
  - Swagger UI and Redoc
- **Testing**
  - 25 automated tests covering auth, permissions, CRUD, and analytics
- **Containerization**
  - Fully Dockerized with PostgreSQL and health checks

---

## 🏗️ Architecture

The project consists of two main services orchestrated via Docker Compose:

### `web`
The Django application:
- handles authentication and JWT issuing
- exposes the Tasks REST API (CRUD, filtering, search, pagination)
- enforces ownership-based permissions
- generates OpenAPI schema and serves Swagger/Redoc

### `db`
PostgreSQL database:
- stores users, tasks, and related metadata
- runs with a Docker health check to ensure `web` starts only once the database is ready

---

## 📁 Project Structure

```text
taskmanager/
├── apps/
│   ├── accounts/
│   │   ├── migrations/
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   └── tasks/
│       ├── migrations/
│       ├── admin.py
│       ├── apps.py
│       ├── filters.py
│       ├── models.py
│       ├── permissions.py
│       ├── serializers.py
│       ├── tests.py
│       ├── urls.py
│       └── views.py
├── config/
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── manage.py
├── pytest.ini
├── requirements.txt
└── README.md
```

---

## 📦 Requirements

- Docker
- Docker Compose

---

## 🔐 Environment Variables

Create a `.env` file in the project root. Use `.env.example` as a template.

```env
# Django
SECRET_KEY=your-secret-key
DEBUG=True

# Database
POSTGRES_DB=taskmanager
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

If PostgreSQL environment variables are not set, the project falls back to SQLite for local development.

---

## 🚀 Running the Project

### 1. Clone the repository

```bash
git clone https://github.com/hezhenn/taskmanager.git
cd taskmanager
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

### 3. Start the containers

```bash
docker compose up --build
```

Docker Compose will:
- start and configure PostgreSQL with a health check
- run database migrations automatically
- start the Django server at `http://localhost:8000`

### 4. Open the API documentation

- Swagger UI: `http://localhost:8000/api/docs/`
- Redoc: `http://localhost:8000/api/redoc/`

---

## 💻 Local Setup (Without Docker)

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env

python manage.py migrate
python manage.py runserver
```

---

## 🧪 Running Tests

```bash
pytest
```

The test suite covers authentication, permissions, CRUD flows, and statistics for tasks (25 tests).

---

## 🌍 API Endpoints

### Authentication (`/api/v1/auth/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|--------------|----------------|
| POST | `/register/` | Register a new user | No |
| POST | `/token/` | Obtain JWT access and refresh tokens | No |
| POST | `/token/refresh/` | Refresh expired access token | No |
| GET | `/me/` | Retrieve current user profile | Yes |
| PATCH | `/me/` | Update current user profile | Yes |

### Tasks (`/api/v1/tasks/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|--------------|----------------|
| GET | `/` | List user's tasks (paginated) | Yes |
| POST | `/` | Create a new task | Yes |
| GET | `/statistics/` | Task analytics & statistics for dashboard | Yes |
| GET | `/{id}/` | Retrieve task details (owner only) | Yes |
| PUT | `/{id}/` | Full update of task (owner only) | Yes |
| PATCH | `/{id}/` | Partial update of task (owner only) | Yes |
| DELETE | `/{id}/` | Delete task (owner only) | Yes |

### Documentation

| Endpoint | Description |
|----------|--------------|
| `/api/schema/` | Download OpenAPI 3.0 schema (YAML/JSON) |
| `/api/docs/` | Interactive Swagger UI |
| `/api/redoc/` | Interactive Redoc documentation |

---

## 💡 Example API Usage

### 1. Register a user

```bash
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alex",
    "email": "alex@example.com",
    "password": "SecurePassword123!",
    "password_confirm": "SecurePassword123!"
  }'
```

### 2. Obtain a JWT token

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alex",
    "password": "SecurePassword123!"
  }'
```

Response:

```json
{
  "access": "<YOUR_ACCESS_TOKEN>",
  "refresh": "<YOUR_REFRESH_TOKEN>"
}
```

### 3. Refresh an access token

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "<YOUR_REFRESH_TOKEN>"
  }'
```

### 4. Create a task

```bash
curl -X POST http://localhost:8000/api/v1/tasks/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -d '{
    "title": "Complete Django project",
    "description": "Implement authentication and tasks CRUD",
    "priority": "HIGH",
    "status": "IN_PROGRESS"
  }'
```

### 5. Filter and search tasks

```bash
curl -G http://localhost:8000/api/v1/tasks/ \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -d "status=IN_PROGRESS" \
  -d "search=Django"
```

### 6. Retrieve current user profile

```bash
curl -X GET http://localhost:8000/api/v1/auth/me/ \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

---

## 🔮 Possible Improvements

A few ideas for future development:

- Add Redis caching for frequently listed tasks
- Add rate limiting on authentication endpoints
- Add soft-delete for tasks instead of permanent deletion
- Add CI pipeline (GitHub Actions) to run tests automatically
- Add task comments or activity history

---

## 📚 What I Practiced

Through this project, I practiced and improved my skills in:

- designing a REST API with Django REST Framework (serializers, viewsets, routers)
- implementing JWT-based authentication and token refresh flows
- writing custom permission classes for ownership-based access control
- building filtering, search, and pagination for API resources
- generating and maintaining OpenAPI documentation with drf-spectacular
- writing automated tests with pytest and pytest-django
- containerizing a multi-service application with Docker Compose and health checks

This project was built as a practical portfolio piece to combine API design, authentication, testing, and Docker-based deployment in one application.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Stanislav Novhorodskyi** — Python Developer

[LinkedIn](https://www.linkedin.com/in/stanislav-novhorodskiy-482924388/) · [GitHub](https://github.com/hezhenn)