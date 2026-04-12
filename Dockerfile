FROM python:3.12-slim

# Install Node.js 22.x
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 --retries 5 -r requirements.txt

# Install Node dependencies
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci

# Copy application code (includes chroma/ data)
COPY . .

# Build Next.js — use empty API URL so calls go through rewrites
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN cd frontend && npm run build

CMD ["bash", "start.sh"]
