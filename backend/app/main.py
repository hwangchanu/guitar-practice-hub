from fastapi import FastAPI

from .routers import separation, analysis, tab, chromatic

app = FastAPI(
    title="Guitar Practice Hub API",
    description="기타 연습 허브 백엔드 API",
    version="0.1.0",
)

app.include_router(separation.router)
app.include_router(analysis.router)
app.include_router(tab.router)
app.include_router(chromatic.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
