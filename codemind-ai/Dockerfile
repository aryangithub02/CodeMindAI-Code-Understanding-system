FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-api.txt requirements.txt
COPY pyproject.toml .
COPY codemind/ ./codemind/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-api.txt
RUN pip install -e .

# Copy application code
COPY . .

# Create directory for repositories
RUN mkdir -p /tmp/codemind-repos

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
