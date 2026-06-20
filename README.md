# Finance Workspace — A FastAPI Backend, Explained for Complete Beginners

This repository is a small but **complete** web application. It lets you keep a
**watchlist** of stock tickers and write **research notes** about them. It has:

- A **backend API** written in Python with [FastAPI](https://fastapi.tiangolo.com/).
- A **PostgreSQL database** (with the `pgvector` extension installed, ready for
  future AI/semantic-search features).
- A small **web page** (HTML + CSS + JavaScript) that talks to that API so you can
  click buttons instead of typing raw commands.
- **Docker** files so the whole thing runs with a single command, no matter what
  computer you are on.
- **Database migrations** (Alembic) so the database schema can evolve safely over time.

This README assumes you have **never built a web app before**. It explains not just
*how* to run it, but *why* every piece exists and *how they fit together*. Read it
top to bottom the first time; later you can jump to the section you need.

---

## Table of contents

1. [The 30-second mental model](#1-the-30-second-mental-model)
2. [What problem does this app solve?](#2-what-problem-does-this-app-solve)
3. [The big picture: how a request flows](#3-the-big-picture-how-a-request-flows)
4. [The folder structure, file by file](#4-the-folder-structure-file-by-file)
5. [How `src/` works (the heart of the app)](#5-how-src-works-the-heart-of-the-app)
6. [The database, models, and schemas (and why there are two)](#6-the-database-models-and-schemas-and-why-there-are-two)
7. [Database migrations with Alembic](#7-database-migrations-with-alembic)
8. [The frontend (`templates/` and `static/`)](#8-the-frontend-templates-and-static)
9. [Configuration and the `.env` file](#9-configuration-and-the-env-file)
10. [Running the app — two ways](#10-running-the-app--two-ways)
11. [Docker and Docker Compose, explained slowly](#11-docker-and-docker-compose-explained-slowly)
12. [The full API reference](#12-the-full-api-reference)
13. [Common tasks (cheat sheet)](#13-common-tasks-cheat-sheet)
14. ["As I scale up, how do I grow this?"](#14-as-i-scale-up-how-do-i-grow-this)
15. [Troubleshooting](#15-troubleshooting)
16. [Glossary of every term used](#16-glossary-of-every-term-used)

---

## 1. The 30-second mental model

Think of the app as a **restaurant**:

| Restaurant | This app | Where it lives |
|---|---|---|
| The dining room / menu you look at | The web page in your browser | `templates/`, `static/` |
| The waiter taking your order | The API (FastAPI) | `src/main.py`, `src/routers/` |
| The kitchen rules ("how do we prepare an order?") | Validation + business logic | `src/schemas.py`, the routers |
| The pantry where food is stored | The database (PostgreSQL) | runs in Docker; described by `src/models.py` |
| Remodeling the pantry shelves | Database migrations | `alembic/` |
| The building + utilities that make it all run | Docker / Docker Compose | `Dockerfile`, `docker-compose.yml` |

You (the customer) never walk into the pantry yourself. You ask the waiter, the
waiter talks to the kitchen, the kitchen talks to the pantry. **That separation is
the single most important idea in web development** — keep reading and it will click.

---

## 2. What problem does this app solve?

Imagine you follow the stock market and want a private place to:

- Keep a **watchlist**: a list of tickers (like `AAPL`, `MSFT`) plus why you care.
- Save **finance notes**: longer research write-ups attached to a ticker, with tags
  and a source link.
- Let **automated tools / AI agents** drop notes into the system through a dedicated
  "ingest" door, separate from the human-facing one.

It is deliberately small so you can read **every line**. But it is built the way a
*real, production* app is built, so the patterns you learn here transfer directly to
bigger projects.

---

## 3. The big picture: how a request flows

Here is what happens, end to end, when you open the app and add a ticker. The page
itself even has a panel ("How this page is wired") that summarizes these steps.

```
┌──────────┐   1. GET /            ┌─────────────────────────────┐
│ Browser  │ ────────────────────► │ FastAPI (src/main.py)       │
│          │ ◄──────────────────── │ returns templates/home.html │
└──────────┘   HTML page            └─────────────────────────────┘
     │
     │ 2. The HTML says "go fetch /static/css/styles.css and /static/js/app.js"
     ▼
┌──────────┐   3. GET /watchlist/  ┌─────────────────────────────┐
│ app.js   │ ────────────────────► │ Router (routers/watchlist)  │
│ (in the  │                       │   → validates with schemas  │
│  browser)│                       │   → asks the database       │
│          │ ◄──────────────────── │   → returns JSON            │
└──────────┘   [ {ticker:"AAPL"} ] └──────────────┬──────────────┘
                                                   │ SQLAlchemy
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │ PostgreSQL database          │
                                    │ tables: watchlist,           │
                                    │         finance_notes        │
                                    └─────────────────────────────┘
```

**Key insight:** the browser and the database never touch each other directly. The
API in the middle is the only thing allowed to read/write the database. This is what
keeps your data safe and your code organized.

A "request" is just a message: *"Hey server, please do X."* A "response" is the
server's reply. The whole web is built on this request → response loop.

---

## 4. The folder structure, file by file

```
polishing-main/
├── .env                     ← Secret-ish settings (passwords, ports). Read at startup.
├── Dockerfile               ← Recipe to package the Python app into a container image.
├── docker-compose.yml       ← Recipe to run app + database + DB admin tool together.
├── requirements.txt         ← The exact list of Python libraries the app needs.
├── alembic.ini              ← Config for the database-migration tool.
│
├── alembic/                 ← Database migrations (version history of your schema).
│   ├── env.py               ← Glue code Alembic runs to connect to your DB.
│   ├── script.py.mako       ← Template used when generating a new migration file.
│   └── versions/            ← One file per schema change, applied in order.
│       ├── b79c8f92502b_create_initial_tables.py
│       ├── 2f4d8c6a9b10_add_finance_note_ingest_fields.py
│       └── c3e7f1a2b4d6_enable_pgvector_extension.py
│
├── src/                     ← ALL the backend Python code lives here.
│   ├── main.py              ← The entry point. Creates the FastAPI app, wires routers.
│   ├── database.py          ← Connects to PostgreSQL; hands out DB "sessions".
│   ├── models.py            ← Defines DB tables as Python classes (SQLAlchemy).
│   ├── schemas.py           ← Defines the shape of API input/output (Pydantic).
│   └── routers/             ← The actual API endpoints, grouped by topic.
│       ├── __init__.py      ← Marks this folder as a Python package (can be empty).
│       ├── watchlist.py     ← /watchlist/...   (CRUD for tickers)
│       ├── financenotes.py  ← /financenotes/... (CRUD for notes)
│       └── ingest.py        ← /ingest/...       (door for automated note ingestion)
│
├── templates/               ← Server-rendered HTML.
│   └── home.html            ← The single web page you see at http://localhost:8000/
│
└── static/                  ← Files served as-is to the browser.
    ├── css/styles.css       ← How the page looks.
    └── js/app.js            ← How the page behaves (calls the API, updates the screen).
```

> **What about `.venv/` and `__pycache__/`?**
> `.venv/` is a *virtual environment* — a private copy of Python plus the installed
> libraries, so this project's dependencies don't clash with other projects.
> `__pycache__/` holds compiled Python bytecode that Python generates automatically.
> **You never edit these by hand**, and ideally they should be listed in a
> `.gitignore` file so they aren't committed to version control. (This repo currently
> has no `.gitignore`; adding one is a good first improvement — see
> [section 14](#14-as-i-scale-up-how-do-i-grow-this).)

---

## 5. How `src/` works (the heart of the app)

`src/` is the backend. Everything else (`templates/`, `static/`) is presentation, and
`alembic/` is database housekeeping. Let's walk through `src/` in the order data
actually flows.

### 5.1 `main.py` — the front door

```python
app = FastAPI()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/health")        # a "are you alive?" check → {"status": "ok"}
@app.get("/")              # serves the home page (home.html)

app.include_router(watchlist.router)
app.include_router(financenotes.router)
app.include_router(ingest.router)
```

What each line does:

- `app = FastAPI()` creates the application object. Everything attaches to it.
- `Jinja2Templates(...)` lets the server fill in and return HTML pages.
- `app.mount("/static", ...)` says "any URL starting with `/static` is a real file on
  disk in the `static/` folder" — that's how the browser gets the CSS and JS.
- `/health` is a tiny endpoint used by Docker and monitoring tools to check the app is
  running. Returning `{"status": "ok"}` means "I'm alive."
- `app.include_router(...)` plugs in the three groups of endpoints. Instead of putting
  every endpoint in one giant file, related endpoints are grouped into **routers**.
  This keeps the code tidy as the app grows.

### 5.2 `routers/` — the endpoints

A **router** is just a file that owns a set of related URLs. Look at the top of each:

```python
router = APIRouter(prefix="/watchlist", tags=["watchlist"])
```

`prefix="/watchlist"` means every endpoint in this file automatically starts with
`/watchlist`. `tags=["watchlist"]` groups them nicely in the auto-generated docs.

Each endpoint is a normal Python function with a **decorator** on top:

```python
@router.get("/", response_model=list[schemas.WatchlistItemRead])
def read_watchlist(db: db_dependency):
    return db.query(WatchlistItem).all()
```

- `@router.get("/")` → "when someone does `GET /watchlist/`, run this function."
- `db: db_dependency` → FastAPI automatically gives this function a live database
  connection. (We'll explain this magic in 5.3.)
- `response_model=...` → FastAPI guarantees the output matches that shape and converts
  the database object into clean JSON.

The three routers together implement **CRUD** — the four basic data operations:

| Letter | Meaning | HTTP method | Example |
|---|---|---|---|
| **C** | Create | `POST` | `POST /watchlist/` add a ticker |
| **R** | Read | `GET` | `GET /watchlist/` list all tickers |
| **U** | Update | `PUT` | `PUT /watchlist/3` edit ticker #3 |
| **D** | Delete | `DELETE` | `DELETE /watchlist/3` remove ticker #3 |

Notice the careful error handling, e.g. in `watchlist.py`:

```python
try:
    db.commit()
except IntegrityError as exc:
    db.rollback()
    raise HTTPException(status_code=409, detail="Ticker already exists in watchlist")
```

The `ticker` column is **unique**. If you try to add a duplicate, the database
refuses, SQLAlchemy raises `IntegrityError`, and instead of crashing we **roll back**
(undo the half-finished change) and return a friendly `409 Conflict` to the user.
Good apps anticipate failure; this is what that looks like.

### 5.3 `database.py` — talking to PostgreSQL

```python
SQLALCHEMY_DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL",
    "postgresql://postgres:test1234!@localhost/fastapi",
)
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Beginner translation:

- The **database URL** is a single string that says *who* (`postgres`), *password*
  (`test1234!`), *where* (`localhost`), and *which database* (`fastapi`). It's read
  from the environment variable `SQLALCHEMY_DATABASE_URL`; the value in quotes is just
  a **fallback** for local development if that variable isn't set.
- The **engine** is the actual pipe to the database. You create it once.
- A **session** is one short conversation with the database (run some queries, save,
  done). You want a *fresh* session per request and you want it *closed* afterward —
  that's exactly what `get_db()` does.
- `get_db()` is a **dependency**: FastAPI calls it for you, opens a session, hands it
  to your endpoint, and the `finally: db.close()` guarantees it's cleaned up even if
  something goes wrong. This pattern prevents "leaked" connections that would
  eventually exhaust the database.
- `Base` is the parent class every table model inherits from (see next section).

In the routers you saw `db_dependency = Annotated[Session, Depends(get_db)]`. That is
just a reusable shorthand for "give me a database session via `get_db`."

---

## 6. The database, models, and schemas (and why there are two)

New developers are almost always confused by this: **why are there `models.py` AND
`schemas.py`? Don't they both describe the data?** Yes — but for two *different*
audiences. This separation is intentional and important.

### 6.1 `models.py` — the shape of the **database**

These are **SQLAlchemy models**. Each class becomes a table; each `Column` becomes a
column. This is the *internal* truth — how data is physically stored.

```python
class WatchlistItem(Base):
    __tablename__ = "watchlist"
    id           = Column(Integer, primary_key=True, index=True)
    ticker       = Column(String, unique=True, index=True, nullable=False)
    company_name = Column(String, nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class FinanceNote(Base):
    __tablename__ = "finance_notes"
    id         = Column(Integer, primary_key=True, index=True)
    ticker     = Column(String, index=True, nullable=False)
    title      = Column(String, nullable=False)
    content    = Column(Text, nullable=False)
    tags       = Column(JSON, default=list, nullable=False)   # a list, stored as JSON
    source_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

Things to notice:

- `primary_key=True` → `id` uniquely identifies each row; the DB auto-numbers it.
- `index=True` → builds a lookup structure so searches on that column are fast.
- `unique=True` on `ticker` → no two watchlist rows can share a ticker.
- `nullable=False` → the column is **required**; `nullable=True` → optional.
- `created_at` defaults to "now, in UTC" automatically when a row is created.

### 6.2 `schemas.py` — the shape of the **API**

These are **Pydantic models**. They describe what JSON the API *accepts* and
*returns*, and they **validate and clean** incoming data before it ever reaches the
database.

```python
class FinanceNoteBase(BaseModel):
    ticker: str
    title: str
    content: str
    tags: list[str] = Field(default_factory=list)
    source_url: str | None = None

    @field_validator("ticker")
    def clean_ticker(cls, value): return value.strip().upper()  # "  aapl " → "AAPL"

    @field_validator("source_url", mode="before")
    def clean_source_url(cls, value):
        # must start with http:// or https:// or it's rejected
        ...
```

The validators are the "kitchen rules": they trim whitespace, force tickers to
uppercase, split a comma-separated tag string into a real list, and reject malformed
URLs — **before** any of it is saved. Garbage never reaches your database.

### 6.3 Why three variants per thing (`Base` / `Create` / `Read`)?

```python
class WatchlistItemBase   # shared fields + validation
class WatchlistItemCreate(WatchlistItemBase)   # what you send to CREATE/UPDATE
class WatchlistItemRead(WatchlistItemBase)     # what the API sends BACK (adds id, created_at)
```

- When you **create** an item you should *not* send an `id` or `created_at` — the
  server assigns those. So `Create` omits them.
- When the API **returns** an item it *should* include `id` and `created_at`. So
  `Read` adds them.
- `model_config = ConfigDict(from_attributes=True)` on the `Read` schemas lets Pydantic
  read straight from a SQLAlchemy object (not just a dict), which is how a database row
  becomes JSON automatically.

There's also `FinanceNoteIngest`, which today is identical to `FinanceNoteCreate`. It
exists as a **separate name on purpose**: the `/ingest` endpoint is meant for
automated/AI agents, and giving it its own schema means you can later add
agent-specific fields or rules without disturbing the human-facing `Create` schema.

> **The golden rule:** `models.py` = how data is *stored*. `schemas.py` = how data
> *enters and leaves* the API. Keeping them separate means you can change your database
> without breaking your public API, and vice-versa.

---

## 7. Database migrations with Alembic

### The problem migrations solve

Your `models.py` describes the tables you *want*. But a running database already has
tables with real data in them. If you add a column to `models.py`, the live database
doesn't magically change. You need a safe, repeatable, **version-controlled** way to
evolve the schema — including on your teammates' machines and in production. That tool
here is **Alembic**.

Think of migrations like **git commits for your database structure**. Each file in
`alembic/versions/` is one step, and they form a chain.

### The chain in this project

```
b79c8f92502b  create initial tables        (watchlist + finance_notes)
      │
      ▼
2f4d8c6a9b10  add finance note ingest fields (adds tags + source_url columns)
      │
      ▼
c3e7f1a2b4d6  enable pgvector extension      (CREATE EXTENSION vector)
```

Each file has an `upgrade()` (apply the change) and a `downgrade()` (undo it). The
`down_revision` field links each migration to its parent, which is how Alembic knows
the order.

That last migration, `enable pgvector extension`, simply runs
`CREATE EXTENSION IF NOT EXISTS vector;`. [pgvector](https://github.com/pgvector/pgvector)
adds a `vector` column type to PostgreSQL used for **semantic / similarity search**
(the kind AI features need). It's enabled and waiting, even though no table uses it
yet — groundwork for future "find notes similar to this one" features.

### `alembic/env.py` and `alembic.ini`

- `alembic.ini` is the static config. Notably its `sqlalchemy.url` is left **blank on
  purpose** so a real password isn't committed to the repo.
- `alembic/env.py` reads the database URL from the `SQLALCHEMY_DATABASE_URL`
  environment variable instead, and points Alembic at `models.Base.metadata` so it
  knows what your tables *should* look like (needed for autogenerate).

### The commands you'll actually run

```bash
# Apply all pending migrations (bring the DB up to the latest version):
alembic upgrade head

# Undo the most recent migration:
alembic downgrade -1

# After you change models.py, auto-generate a new migration:
alembic revision --autogenerate -m "describe your change"

# See where the database currently is and the full history:
alembic current
alembic history
```

> **Important:** Alembic needs to know your database URL. Set it first, e.g.
> `export SQLALCHEMY_DATABASE_URL=postgresql://postgres:change-me@localhost:5432/fastapi`
> When running inside Docker Compose, the URL is already provided via the `.env` file.

---

## 8. The frontend (`templates/` and `static/`)

The app ships a single web page so you can use it without any API knowledge. There is
**no React/Vue/build step** — it's intentionally plain so a beginner can read it.

### `templates/home.html`

A normal HTML page served by FastAPI at `/`. It contains:

- **Summary cards** (counts of watchlist items, notes, unique tickers, backend status).
- **A filter bar** (search box, ticker dropdown, sort order).
- **Two forms** to add/edit a watchlist item and a finance note.
- **Two lists** that display saved records as cards.
- **A dialog** that pops up to show full record details.

It loads its styling and behavior via:

```html
<link rel="stylesheet" href="{{ url_for('static', path='/css/styles.css') }}?v=layout-3">
<script  src="{{ url_for('static', path='/js/app.js') }}"></script>
```

`{{ url_for(...) }}` is **Jinja2** templating — the server fills in the correct path.
The `?v=layout-3` is a **cache-buster**: bump it and browsers fetch the fresh CSS
instead of an old cached copy.

### `static/js/app.js` — where the page comes alive

This ~650-line vanilla-JavaScript file is the "brain" of the page. In plain terms it:

1. Keeps a small **`state`** object in memory (`watchlist`, `notes`, current
   `search`/`ticker`/`sort` filters).
2. On load, calls `loadData()`, which does `fetch("/watchlist/")` and
   `fetch("/financenotes/")` **at the same time** (`Promise.all`) and stores the
   results.
3. **Renders** everything to the screen: summary counts, the ticker dropdown, and the
   two card lists — applying your search/filter/sort on the client side.
4. Handles the **forms**: collects what you typed, normalizes it (uppercase ticker,
   tags split by comma), and `POST`s (create) or `PUT`s (edit) it to the API, then
   reloads.
5. Handles **View / Edit / Delete** buttons on each card via one shared click listener
   (a pattern called *event delegation* — one listener instead of hundreds).
6. Has a single `apiRequest()` helper that wraps `fetch`, sets JSON headers, and turns
   error responses into readable messages.

The takeaway: **the frontend only ever talks to the API over HTTP.** It has no idea
PostgreSQL exists. If you swapped the database tomorrow, this file wouldn't change.

### `static/css/styles.css`

774 lines of styling — colors, spacing, the card/grid layout, the dialog, responsive
behavior. Pure cosmetics; nothing here affects how data works.

---

## 9. Configuration and the `.env` file

A `.env` file holds settings that change between environments (your laptop vs. a
server) and secrets you don't want hard-coded. This project's `.env`:

```ini
API_PORT=8000
POSTGRES_PORT=5432
ADMINER_PORT=8080
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
POSTGRES_DB=fastapi
SQLALCHEMY_DATABASE_URL=postgresql://postgres:change-me@db:5432/fastapi
```

- The `*_PORT` values control which ports get exposed on your machine.
- `POSTGRES_USER/PASSWORD/DB` configure the database container on first launch.
- `SQLALCHEMY_DATABASE_URL` is the connection string the app and Alembic use. Notice
  the host is **`db`**, not `localhost` — inside Docker Compose, the database service
  is reachable by its service name `db`. (If you run the app *outside* Docker, you'd
  use `localhost` instead.)

> ⚠️ **Security note for real deployments:** this `.env` is committed to the repo with
> a placeholder password (`change-me`). That's fine for a demo, but in a real project
> you should **never commit real secrets**. Add `.env` to a `.gitignore`, commit a
> `.env.example` with blank values instead, and use a strong password. See
> [section 14](#14-as-i-scale-up-how-do-i-grow-this).

---

## 10. Running the app — two ways

### Prerequisites

- For the Docker path: install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- For the manual path: Python 3.14 and a running PostgreSQL with the `pgvector`
  extension available.

### Option A — Docker Compose (recommended, easiest)

This starts the API, the database, and a database admin UI together with one command.

```bash
# 1. From the project root, build and start everything:
docker compose up --build

# 2. In a second terminal, create the tables by running migrations
#    inside the running api container:
docker compose exec api alembic upgrade head

# 3. Open the app:
#    Web page  → http://localhost:8000/
#    API docs  → http://localhost:8000/docs
#    Adminer   → http://localhost:8080   (DB browser; server: db, user/pass from .env)

# To stop:
docker compose down
# To stop AND erase the database volume (start fresh):
docker compose down -v
```

### Option B — Run it manually (no Docker for the app)

Useful when you want to debug the Python directly. You still need a PostgreSQL
somewhere.

```bash
# 1. Create and activate a virtual environment:
python3 -m venv .venv
source .venv/bin/activate          # on Windows: .venv\Scripts\activate

# 2. Install dependencies:
pip install -r requirements.txt

# 3. Tell the app where the database is:
export SQLALCHEMY_DATABASE_URL=postgresql://postgres:change-me@localhost:5432/fastapi

# 4. Create the tables:
alembic upgrade head

# 5. Start the server (note: code lives in src/, hence --app-dir src):
uvicorn main:app --app-dir src --reload --host 0.0.0.0 --port 8000
```

`--reload` makes the server restart automatically whenever you save a `.py` file —
great while developing, but leave it off in production.

---

## 11. Docker and Docker Compose, explained slowly

If you've never used Docker, here's the why.

### The problem Docker solves

"It works on my machine" is the oldest bug in software. Your laptop has one Python
version, your teammate's has another, the server has a third. Docker fixes this by
packaging your app *together with* its exact operating system, Python version, and
libraries into a **container** — a sealed box that runs identically everywhere.

### The `Dockerfile` — packaging the app

```dockerfile
FROM python:3.14-slim          # start from a minimal Linux with Python 3.14
ENV PYTHONDONTWRITEBYTECODE=1 \ # don't litter .pyc files
    PYTHONUNBUFFERED=1          # show logs immediately
WORKDIR /app                   # work inside /app in the container
COPY requirements.txt .        # copy the dependency list first...
RUN pip install -r requirements.txt   # ...and install (this layer is cached!)
COPY . .                       # then copy the rest of the source code
EXPOSE 8000                    # document that the app listens on port 8000
CMD ["uvicorn", "main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
```

A `Dockerfile` is a **recipe to build one image** (the app). The order matters:
dependencies are copied/installed *before* the source code so that when you change
your code (but not your dependencies), Docker reuses the cached install step and
rebuilds in seconds instead of minutes. This "layer caching" is the single biggest
Docker speed trick.

### The `docker-compose.yml` — running several containers together

A real app isn't just one process — it's the app **plus** a database **plus** maybe an
admin tool. Compose describes and runs them all together. This file defines three
**services**:

| Service | Image | What it is | Port (on your machine) |
|---|---|---|---|
| `api` | built from our `Dockerfile` | the FastAPI app | `127.0.0.1:8000` |
| `db` | `pgvector/pgvector:pg16` | PostgreSQL 16 + pgvector | `127.0.0.1:5432` |
| `adminer` | `adminer:4.8.1` | a web UI to browse the DB | `127.0.0.1:8080` |

Important details in this file, and *why*:

- **`depends_on: db: condition: service_healthy`** — the API waits until the database
  passes its **healthcheck** (`pg_isready`) before starting. Without this, the API
  might boot before the DB is ready and crash.
- **`volumes: postgres_data:/var/lib/postgresql/data`** — a **named volume** persists
  the database files outside the container. This is why your data survives
  `docker compose down` and a rebuild. (`down -v` deletes this volume on purpose.)
- **`ports: "127.0.0.1:${API_PORT}:8000"`** — binding to `127.0.0.1` exposes the ports
  only to *your own machine*, not the whole network. A safe default.
- **`restart: unless-stopped`** — if a container crashes, Docker restarts it
  automatically unless you deliberately stopped it.
- **`environment: ... ${VAR}`** — values come from the `.env` file, so configuration
  stays in one place.

How services talk to each other: inside Compose, containers reach one another by
**service name**. That's why `SQLALCHEMY_DATABASE_URL` uses `@db:5432` — `db` resolves
to the database container. Adminer similarly uses `ADMINER_DEFAULT_SERVER: db`.

---

## 12. The full API reference

You can explore and **try every endpoint live** in your browser at
`http://localhost:8000/docs` (Swagger UI, auto-generated by FastAPI). Here's the
complete list.

### Health & page

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check → `{"status": "ok"}` |
| `GET` | `/` | Returns the `home.html` web page |

### Watchlist — `/watchlist`

| Method | Path | Purpose | Success | Notable errors |
|---|---|---|---|---|
| `GET` | `/watchlist/` | List all watchlist items | `200` | — |
| `GET` | `/watchlist/{id}` | Get one item by id | `200` | `404` not found |
| `POST` | `/watchlist/` | Create an item | `201` | `409` ticker exists, `422` invalid |
| `PUT` | `/watchlist/{id}` | Update an item | `200` | `404`, `409`, `422` |
| `DELETE` | `/watchlist/{id}` | Delete an item | `200` | `404` not found |

### Finance notes — `/financenotes`

| Method | Path | Purpose | Success | Notable errors |
|---|---|---|---|---|
| `GET` | `/financenotes/` | List all notes | `200` | — |
| `GET` | `/financenotes/{id}` | Get one note | `200` | `404` |
| `POST` | `/financenotes/` | Create a note | `201` | `422` invalid |
| `PUT` | `/financenotes/{id}` | Update a note | `200` | `404`, `422` |
| `DELETE` | `/financenotes/{id}` | Delete a note | `200` | `404` |

### Ingest — `/ingest`

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/ingest/finance-notes` | Create a note (door for automated agents) | `201` |

### Example: create a watchlist item with `curl`

```bash
curl -X POST http://localhost:8000/watchlist/ \
  -H "Content-Type: application/json" \
  -d '{"ticker": "aapl", "company_name": "Apple Inc.", "notes": "watching earnings"}'
```

Response (`201 Created`) — note the ticker was uppercased and an `id` + `created_at`
were assigned by the server:

```json
{
  "ticker": "AAPL",
  "company_name": "Apple Inc.",
  "notes": "watching earnings",
  "id": 1,
  "created_at": "2026-06-20T12:00:00Z"
}
```

> **HTTP status codes in one line:** `2xx` = success, `4xx` = you (the client) made a
> mistake (e.g. `404` not found, `409` conflict, `422` validation failed), `5xx` = the
> server broke.

---

## 13. Common tasks (cheat sheet)

```bash
# Start everything (Docker):
docker compose up --build

# Apply DB migrations:
docker compose exec api alembic upgrade head        # in Docker
alembic upgrade head                                # running locally

# Watch the app's logs:
docker compose logs -f api

# Open a shell inside the running app container:
docker compose exec api bash

# Create a new migration after editing src/models.py:
docker compose exec api alembic revision --autogenerate -m "add price column"

# Browse the database visually:  open http://localhost:8080  (Adminer)

# Stop everything (data kept):
docker compose down

# Stop and wipe the database:
docker compose down -v
```

### How to add a brand-new feature (worked example)

Say you want to track a **target price** on watchlist items. The end-to-end flow:

1. **Model** — add `target_price = Column(Float, nullable=True)` to `WatchlistItem` in
   `src/models.py`.
2. **Migration** — run `alembic revision --autogenerate -m "add target_price"`, eyeball
   the generated file in `alembic/versions/`, then `alembic upgrade head`.
3. **Schema** — add `target_price: float | None = None` to `WatchlistItemBase` in
   `src/schemas.py` so the API accepts and returns it.
4. **Router** — if updating, set `watchlist_item.target_price = ...` in the `PUT`
   handler in `src/routers/watchlist.py`.
5. **Frontend** (optional) — add an input to the form in `templates/home.html` and
   include it in `watchlistPayload()` in `static/js/app.js`.

That five-step path — **model → migration → schema → router → UI** — is the rhythm of
almost every change you'll make in this codebase.

---

## 14. "As I scale up, how do I grow this?"

This project is structured to grow. Here's the realistic path from "demo on my laptop"
to "real service," and what each `Dockerfile` / `docker-compose.yml` / code change
looks like.

### Stage 1 — Tidy up the basics (do these first)

- **Add a `.gitignore`** so `.venv/`, `__pycache__/`, and `.env` aren't committed.
- **Stop committing real secrets.** Replace `.env` in git with a `.env.example` of
  blank keys; keep your real `.env` local only.
- **Add automated tests.** `pytest`, `pytest-asyncio`, and `httpx` are already in
  `requirements.txt` — you can spin up a test client and hit endpoints without a
  browser.

### Stage 2 — Make the single app instance solid

- **Add CORS** if a separate frontend (on another domain) will call the API
  (`fastapi.middleware.cors.CORSMiddleware`).
- **Add authentication.** `python-jose`, `passlib`, and `bcrypt` are already installed,
  meaning the project is pre-provisioned for JWT-based login — you just haven't wired it
  up yet. Add a users table, a login endpoint that issues a token, and a dependency that
  protects the routers.
- **Add pagination** to the list endpoints (`?limit=&offset=`) so `GET /financenotes/`
  doesn't return thousands of rows at once.
- **Split `requirements.txt`** into runtime vs. dev (move `black`, `pytest` out of the
  production image to keep it small).

### Stage 3 — Run more copies of the app (horizontal scaling)

When one container isn't enough, you run several and put a load balancer in front. With
Compose you can already do:

```bash
docker compose up --scale api=3
```

This starts **three** `api` containers sharing the one `db`. Because the app is
**stateless** (it keeps nothing important in memory — all state lives in PostgreSQL),
any container can handle any request. *This is why the model/schema/database separation
matters: it's what makes horizontal scaling possible.* To make `--scale` truly useful
you'd add a reverse proxy/load balancer service (e.g. **nginx** or **Traefik**) in
`docker-compose.yml` to spread traffic across the three.

You'd also tune the server itself — run uvicorn with multiple workers (or behind
**gunicorn**), e.g. `uvicorn main:app --workers 4`, so each container uses all its CPU
cores.

### Stage 4 — Production-grade Docker

Evolve the `Dockerfile` and Compose setup:

- **Multi-stage builds** to produce a smaller, faster final image (build deps in one
  stage, copy only what's needed into a slim runtime stage).
- **A non-root user** in the container for security.
- **Separate Compose files** — `docker-compose.yml` for shared config plus
  `docker-compose.override.yml` (local dev, with `--reload`) and a
  `docker-compose.prod.yml` (no reload, real secrets via a secrets manager, healthchecks
  on the API too).
- **Run migrations on deploy**, not by hand — e.g. an entrypoint script or a one-shot
  "migrate" service that runs `alembic upgrade head` before the API starts.

### Stage 5 — Beyond a single host

- **Managed PostgreSQL** (AWS RDS, Cloud SQL, etc.) instead of the `db` container, so
  backups, failover, and scaling are handled for you. Just point
  `SQLALCHEMY_DATABASE_URL` at it.
- **Kubernetes** if you outgrow a single machine — your `Dockerfile` image works
  unchanged; you translate the Compose services into Kubernetes Deployments/Services.
- **Connection pooling** (e.g. **PgBouncer**) once you have many app instances all
  opening database connections.
- **Caching / background jobs** (Redis, Celery) for expensive work.
- **The pgvector groundwork pays off here:** add an embedding column to
  `finance_notes`, generate vectors for each note's content, and you can offer
  "semantically similar notes" or AI search — the extension is already enabled by
  migration `c3e7f1a2b4d6`.

The reassuring part: **none of this requires rewriting the app.** The clean layering
(presentation → API → models → database, with migrations and config externalized) is
exactly what lets you bolt on scale piece by piece.

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Page loads but cards say "Could not load API data" | API can't reach the database | Check `db` container is healthy (`docker compose ps`); confirm migrations ran |
| `relation "watchlist" does not exist` | Migrations not applied | Run `alembic upgrade head` |
| `409 Ticker already exists` | The ticker is unique; you added a duplicate | Edit the existing card instead, or use a different ticker |
| `422 Unprocessable Entity` | Input failed validation | Check required fields; `source_url` must start with `http://`/`https://` |
| `connection refused` on port 5432/8000 | Service not up yet, or port in use | Wait for healthcheck; change the port in `.env` if it clashes |
| Code change didn't take effect | Running without `--reload`, or Docker image is stale | Use `--reload` locally, or `docker compose up --build` |
| Alembic: "Set SQLALCHEMY_DATABASE_URL..." | The env var isn't set | `export SQLALCHEMY_DATABASE_URL=...` before running Alembic |

---

## 16. Glossary of every term used

- **API (Application Programming Interface):** a set of URLs ("endpoints") other
  programs can call to read or change data. Here it speaks JSON over HTTP.
- **Endpoint / route:** one specific URL + method the API responds to, e.g.
  `GET /watchlist/`.
- **HTTP method:** the *verb* of a request — `GET` (read), `POST` (create), `PUT`
  (replace/update), `DELETE` (remove).
- **JSON:** a simple text format for structured data, like
  `{"ticker": "AAPL"}`. The lingua franca of web APIs.
- **FastAPI:** the Python web framework used for the backend. Fast, modern, and
  generates interactive docs automatically.
- **Uvicorn:** the program (an "ASGI server") that actually runs the FastAPI app and
  listens for web requests.
- **Router:** a FastAPI object that groups related endpoints into one file.
- **Pydantic / schema:** library + classes that validate and shape API input/output
  (`schemas.py`).
- **SQLAlchemy / model:** the library + classes that map Python objects to database
  tables (`models.py`). An **ORM** (Object-Relational Mapper).
- **Session (DB):** one short-lived conversation with the database.
- **Engine (DB):** the configured connection to the database, created once.
- **PostgreSQL:** the relational database that stores the data.
- **pgvector:** a PostgreSQL extension adding a `vector` type for AI/similarity search.
- **Migration / Alembic:** a versioned, ordered change to the database schema, and the
  tool that manages them.
- **CRUD:** Create, Read, Update, Delete — the four basic data operations.
- **Dependency injection:** FastAPI automatically supplying things your endpoint needs
  (like a DB session) via `Depends(...)`.
- **Container / image:** a sealed package of an app + its environment (image = the
  recipe/snapshot, container = a running instance of it).
- **Docker / Docker Compose:** tools to build images and run multiple containers
  together.
- **Volume:** Docker storage that persists data outside a container's lifetime.
- **Healthcheck:** a command Docker runs to decide if a container is "ready."
- **Environment variable / `.env`:** configuration passed in from outside the code, so
  the same code runs in different setups.
- **Stateless:** the app keeps no important data in its own memory; all state lives in
  the database — which is what allows running many copies.
- **Jinja2:** the templating engine that fills in `templates/home.html` before sending
  it to the browser.
- **Static files:** files (CSS, JS) served to the browser exactly as they are on disk.
- **CORS:** browser security rule about which other websites may call your API.
- **JWT / auth:** a signed token proving who a user is (the libraries for this are
  already installed but not yet wired up).

---

### Final mental model to remember

> **Browser ⇄ API ⇄ Database**, with **schemas** guarding the API door, **models**
> describing the database, **migrations** evolving it safely, and **Docker** making the
> whole thing run identically everywhere. Master those five words — *browser, API,
> schema, model, migration* — and you understand this entire repository.

Happy building. Start the app, open `/docs`, click around, then read the file behind
each endpoint. It'll all connect.
