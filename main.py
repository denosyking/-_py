import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load env before importing other modules
load_dotenv()

from database import init_db
from bot_app import start_bot
from api.public import router as public_router
from api.admin import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Start bot in background
    bot_task = asyncio.create_task(start_bot())
    yield
    # Shutdown
    bot_task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")

# Mount static files (frontend)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
