from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import schemas
from database import get_db
from models import WatchlistItem

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


db_dependency = Annotated[Session, Depends(get_db)]


@router.get("/", status_code=200, response_model=list[schemas.WatchlistItemRead])
def read_watchlist(db: db_dependency):
    return db.query(WatchlistItem).all()


@router.get(
    "/{watchlist_item_id}",
    status_code=200,
    response_model=schemas.WatchlistItemRead,
)
def read_watchlist_item_by_id(db: db_dependency, watchlist_item_id: int = Path(gt=0)):
    watchlist_item = (
        db.query(WatchlistItem).filter(WatchlistItem.id == watchlist_item_id).first()
    )
    if watchlist_item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    return watchlist_item


@router.post("/", status_code=201, response_model=schemas.WatchlistItemRead)
def create_watchlist_item(
    db: db_dependency,
    watchlist_item_request: schemas.WatchlistItemCreate,
):
    watchlist_item_model = WatchlistItem(**watchlist_item_request.model_dump())
    db.add(watchlist_item_model)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ticker already exists in watchlist",
        ) from exc

    db.refresh(watchlist_item_model)
    return watchlist_item_model


@router.put("/{watchlist_item_id}", response_model=schemas.WatchlistItemRead)
def update_watchlist_item(
    db: db_dependency,
    watchlist_item_request: schemas.WatchlistItemCreate,
    watchlist_item_id: int = Path(gt=0),
):
    watchlist_item = (
        db.query(WatchlistItem).filter(WatchlistItem.id == watchlist_item_id).first()
    )
    if watchlist_item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    watchlist_item.ticker = watchlist_item_request.ticker
    watchlist_item.company_name = watchlist_item_request.company_name
    watchlist_item.notes = watchlist_item_request.notes

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ticker already exists in watchlist",
        ) from exc

    db.refresh(watchlist_item)
    return watchlist_item


@router.delete("/{watchlist_item_id}")
def delete_watchlist_item(
    db: db_dependency,
    watchlist_item_id: int = Path(gt=0),
):
    watchlist_item = (
        db.query(WatchlistItem).filter(WatchlistItem.id == watchlist_item_id).first()
    )
    if watchlist_item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    db.delete(watchlist_item)
    db.commit()
    return {"message": "Watchlist item deleted successfully"}
