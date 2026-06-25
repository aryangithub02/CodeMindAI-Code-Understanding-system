# CodeMind AI Backend Deployment

This guide explains how to deploy the CodeMind AI FastAPI backend to Railway, Render, or any container-based hosting platform.

## Local Development

```bash
cd codemind-ai
pip install -r requirements-api.txt
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

## Deploy to Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize and Deploy**
   ```bash
   cd codemind-ai
   railway init
   railway up
   ```

4. **Get the deployed URL**
   ```bash
   railway domain
   ```

## Deploy to Render

1. **Push code to GitHub**

2. **Go to [render.com](https://render.com)**

3. **Create a new Web Service**
   - Connect your GitHub repository
   - Select the `codemind-ai` directory
   - Build command: `pip install -r requirements-api.txt && pip install -e .`
   - Start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - Environment Variables: None required (uses defaults)

4. **Deploy** - Render will build and deploy your service

## Deploy to AWS Lambda (Optional)

You can use AWS Lambda with API Gateway for serverless deployment:

1. Install serverless dependencies:
   ```bash
   pip install mangum
   ```

2. Update `api/main.py` to use Mangum:
   ```python
   from mangum import Mangum
   
   app = FastAPI(...)
   handler = Mangum(app)
   ```

3. Deploy using Serverless Framework or AWS SAM

## Environment Variables

Optional environment variables:

- `REPOS_DIR`: Directory for storing cloned repositories (default: `/tmp/codemind-repos`)
- `PORT`: Port for the server (default: 8000)

## API Endpoints

Once deployed, the API will be available at your domain:

- `GET /` - Health check
- `GET /api/repositories` - List all repositories
- `POST /api/upload/url` - Upload repository from Git URL
- `POST /api/upload` - Upload repository as zip file
- `GET /api/repository/{id}` - Get repository details
- `GET /api/architecture/{id}` - Get architecture analysis
- `GET /api/dataflow/{id}` - Get data flow analysis
- `GET /api/documentation/{id}` - Get documentation
- And more... (see `api/main.py`)

## Connecting Frontend

After deploying the backend:

1. Get your backend URL (e.g., `https://your-backend.railway.app`)

2. In Vercel dashboard for your frontend:
   - Go to Settings → Environment Variables
   - Add `NEXT_PUBLIC_API_URL` with your backend URL

3. Redeploy the frontend

## Testing

Test your deployed API:

```bash
curl https://your-backend-url.railway.app/
```

You should see:
```json
{
  "name": "CodeMind AI API",
  "version": "0.1.0",
  "status": "running"
}
```
