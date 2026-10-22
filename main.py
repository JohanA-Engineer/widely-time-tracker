"""
==============================================================================
Widely Time Tracker & Financial Dashboard
Backend en Python con FastAPI
==============================================================================
Este servidor sirve la aplicación web moderna (Frontend con Firebase en tiempo real)
y proporciona endpoints de diagnóstico y salud.

Para ejecutar:
    pip install -r requirements.txt
    python main.py
o:
    uvicorn main:app --reload --port 8000
==============================================================================
"""

import os
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn

app = FastAPI(
    title="Widely Time Tracker & Finance API",
    description="Backend en Python (FastAPI) para soporte y servicio de la aplicación de Time Tracking",
    version="1.0.0"
)

# Sin CORS: solo la propia app (servida desde este mismo servidor) puede leer sus respuestas.
# TrustedHost bloquea ataques de DNS rebinding desde otras páginas web.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1"])

# Directorio base donde residen los archivos estáticos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Únicos archivos que se sirven (los mismos que publica GitHub Pages).
# Nunca se exponen .git, scripts, reglas ni documentación.
PUBLIC_FILES = {
    "index.html", "app.js", "env.js", "styles.css", "tailwind.min.css",
    "sw.js", "manifest.json", "icon-192.svg", "icon-512.svg",
}

# Endpoint de Salud / Diagnóstico
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Widely Time Tracker Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": "3.13+"
    }

# Endpoint para servir la aplicación principal (index.html)
@app.get("/")
def serve_index():
    index_file = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "index.html no encontrado en el directorio"}

# Archivos estáticos de la app, solo desde la lista permitida
@app.get("/{filename}")
def serve_public_file(filename: str):
    path = os.path.join(BASE_DIR, filename)
    if filename not in PUBLIC_FILES or not os.path.isfile(path):
        return JSONResponse({"error": "no encontrado"}, status_code=404)
    return FileResponse(path)

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(" [OK] Servidor Widely Time Tracker iniciado")
    print(" [*] Abre tu navegador en: http://localhost:8000")
    print(" [*] Documentacion interactiva API: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
