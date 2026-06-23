# CodeMind AI — Backend

The backend is a **Python CLI tool** (`codemind-ai/`) that analyzes repositories and produces structured JSON output. It is not a web server — there is no HTTP API to run.

To serve the frontend with real data, you need to either:

## Option 1: Use the CLI directly (recommended for local dev)

Run analysis on a repository and redirect output to a file:

```bash
# Activate Python environment first
cd codemind-ai

# Install dependencies
pip install -e .

# Run full analysis
codemind analyze /path/to/repo --format json --output analysis.json

# Generate specific outputs
codemind graph /path/to/repo --format json         # Dependency graph
codemind security /path/to/repo                     # Security scan
codemind quality /path/to/repo                      # Code quality
codemind onboarding /path/to/repo --days 5           # Onboarding guide
codemind doc /path/to/repo --type architecture       # Documentation

# Quick summary
codemind summary /path/to/repo
```

## Option 2: Set up a minimal API server

The frontend expects these API endpoints:

```
GET  /dashboard/stats       → DashboardStats
GET  /repositories           → Repository[]
GET  /repository/:id        → Repository
POST /upload                 → Repository (multipart/form-data)
POST /upload/url             → Repository (JSON body: { url })
GET  /repository/:id/tree   → RepositoryTreeNode[]
GET  /repository/:id/file   → file content (query param: path)
GET  /architecture/:id      → AnalysisResult
GET  /dependencies/:id      → DependencyAnalysis
GET  /dataflow/:id          → DataFlowAnalysis
GET  /documentation/:id     → DocumentationResult
GET  /onboarding/:id        → OnboardingPlan
POST /chat                  → ChatMessage (streaming SSE)
```

You can wrap the CLI with a lightweight Python server using **FastAPI**:

```bash
pip install fastapi uvicorn

# Or add to requirements.txt:
# fastapi>=0.100.0
# uvicorn>=0.23.0
```

Example server (`server.py`):

```python
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import subprocess, json, tempfile, os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def run_cli(repo_path: str) -> dict:
    result = subprocess.run(
        ["codemind", "analyze", repo_path, "--format", "json"],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

@app.get("/dashboard/stats")
async def dashboard_stats():
    # Return aggregated stats from all analyzed repos
    return {
        "totalRepositories": 0, "totalFiles": 0,
        "totalClasses": 0, "totalFunctions": 0,
        "architectureStyle": "N/A", "riskLevel": "Low",
        "circularDependencies": 0,
    }

@app.post("/upload")
async def upload(file: UploadFile):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, file.filename)
        with open(path, "wb") as f:
            f.write(await file.read())
        # Extract and analyze
        # ...
    return {"id": "repo-id", "name": file.filename, "status": "queued"}

@app.post("/upload/url")
async def upload_url(body: dict):
    url = body.get("url")
    # Clone repo from URL and analyze
    # ...
    return {"id": "repo-id", "name": url.split("/")[-1], "status": "queued"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Then start the server:

```bash
python server.py
```

And set the environment variable in the frontend:

```bash
# codemind-frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Option 3: Mock API responses (quickest)

If you just want to test the frontend UI without the backend, set up a simple mock server:

```bash
# Install mock server
npm install -g json-server

# Create db.json with mock data matching the API types
json-server --watch db.json --port 8000

# Set env var
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Frontend Configuration

The frontend reads the API URL from an environment variable:

```
# codemind-frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If unset, API calls go to relative paths on the same origin (handy if you serve the API from the Next.js `app/api/` routes).

## CLI Reference

| Command       | Description                          |
|---------------|--------------------------------------|
| `analyze`     | Full repository analysis             |
| `graph`       | Dependency/knowledge graph           |
| `security`    | Security vulnerability scan          |
| `quality`     | Code quality analysis                |
| `onboarding`  | Developer onboarding guide           |
| `doc`         | Generate documentation               |
| `summary`     | Quick repository summary             |

All commands accept `--output` / `-o` for file output and `--format` for JSON or Markdown.

## Profiles

Built-in profiles in `codemind-ai/config/profiles/`:

- `full_analysis.json` — comprehensive analysis
- `quick_scan.json` — fast overview
- `security_focus.json` — security-only scan

Use with: `codemind analyze /path --profile quick_scan`
