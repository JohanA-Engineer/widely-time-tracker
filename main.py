"""
==============================================================================
Widely Time Tracker & Financial Dashboard
Backend en Python con FastAPI
==============================================================================
Este servidor sirve la aplicación web moderna (Frontend con Firebase en tiempo real)
y proporciona endpoints de diagnóstico y salud.

Para ejecutar:
    pip install fastapi uvicorn
    python main.py
o:
    uvicorn main:app --reload --port 8000
==============================================================================
"""

import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="Widely Time Tracker & Finance API",
    description="Backend en Python (FastAPI) para soporte y servicio de la aplicación de Time Tracking",
    version="1.0.0"
)

# Permitir CORS (útil para desarrollo y despliegues desacoplados)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio base donde residen los archivos estáticos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Endpoint de Salud / Diagnóstico
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Widely Time Tracker Backend",
        "timestamp": datetime.utcnow().isoformat(),
        "python_version": "3.13+"
    }

# Endpoint para servir la aplicación principal (index.html)
@app.get("/")
def serve_index():
    index_file = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "index.html no encontrado en el directorio"}

# Montar archivos estáticos (styles.css, app.js, recursos adicionales)
# Se monta al final para permitir que la ruta raíz '/' responda primero
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(" [OK] Servidor Widely Time Tracker iniciado")
    print(" [*] Abre tu navegador en: http://localhost:8000")
    print(" [*] Documentacion interactiva API: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
