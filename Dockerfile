FROM python:3.12-slim

WORKDIR /app

COPY server.py viewer.html catalog.json ./
COPY images/ ./images/

ENV HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000

CMD ["python3", "server.py"]
