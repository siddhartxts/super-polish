from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from routers import financenotes, ingest, watchlist

app = FastAPI()


templates = Jinja2Templates(directory="templates")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "home.html")


app.include_router(watchlist.router)
app.include_router(financenotes.router)
app.include_router(ingest.router)
