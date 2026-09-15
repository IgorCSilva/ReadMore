# ---- frontend build stage: produces frontend/dist/, nothing else from this
# stage ships in the final image (no Node.js runtime needed at serve time). ----
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---- runtime image ----
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app/ ./backend/app/
COPY backend/words/ ./backend/words/
COPY backend/content/ ./backend/content/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app.main:app --host ${HOST} --port ${PORT}"]
