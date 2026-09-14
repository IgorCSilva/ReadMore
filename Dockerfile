FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app/ ./backend/app/
COPY backend/catalog.json ./backend/
COPY frontend/ ./frontend/

ENV HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app.main:app --host ${HOST} --port ${PORT}"]
