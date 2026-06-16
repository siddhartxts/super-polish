from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

import schemas
from database import get_db
from models import FinanceNote

router = APIRouter(prefix="/financenotes", tags=["financenotes"])

db_dependency = Annotated[Session, Depends(get_db)]


@router.get("/", status_code=200, response_model=list[schemas.FinanceNoteRead])
def read_finance_notes(db: db_dependency):
    return db.query(FinanceNote).all()


@router.get(
    "/{finance_note_id}", status_code=200, response_model=schemas.FinanceNoteRead
)
def read_finance_note_by_id(db: db_dependency, finance_note_id: int = Path(gt=0)):
    finance_note = (
        db.query(FinanceNote).filter(FinanceNote.id == finance_note_id).first()
    )
    if finance_note is None:
        raise HTTPException(status_code=404, detail="Finance note not found")
    return finance_note


@router.post("/", status_code=201, response_model=schemas.FinanceNoteRead)
def create_finance_note(
    db: db_dependency, finance_note_request: schemas.FinanceNoteCreate
):
    finance_note_model = FinanceNote(**finance_note_request.model_dump())
    db.add(finance_note_model)
    db.commit()
    db.refresh(finance_note_model)
    return finance_note_model


@router.put("/{finance_note_id}", response_model=schemas.FinanceNoteRead)
def update_finance_note(
    db: db_dependency,
    finance_note_request: schemas.FinanceNoteCreate,
    finance_note_id: int = Path(gt=0),
):
    finance_note = (
        db.query(FinanceNote).filter(FinanceNote.id == finance_note_id).first()
    )
    if finance_note is None:
        raise HTTPException(status_code=404, detail="Finance note not found")

    finance_note.ticker = finance_note_request.ticker
    finance_note.title = finance_note_request.title
    finance_note.content = finance_note_request.content
    finance_note.tags = finance_note_request.tags
    finance_note.source_url = finance_note_request.source_url
    db.commit()
    db.refresh(finance_note)
    return finance_note


@router.delete("/{finance_note_id}")
def delete_finance_note(
    db: db_dependency,
    finance_note_id: int = Path(gt=0),
):
    finance_note = (
        db.query(FinanceNote).filter(FinanceNote.id == finance_note_id).first()
    )
    if finance_note is None:
        raise HTTPException(status_code=404, detail="Finance note not found")

    db.delete(finance_note)
    db.commit()
    return {"message": "Finance note deleted successfully"}
