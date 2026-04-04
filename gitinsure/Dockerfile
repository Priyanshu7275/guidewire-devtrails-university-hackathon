FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Ensure database initialized before starting
CMD ["sh", "-c", "python -c 'from database import init_db; init_db()' && uvicorn main:app --host 0.0.0.0 --port 8000"]
