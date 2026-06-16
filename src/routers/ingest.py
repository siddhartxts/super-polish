from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import schemas
from database import get_db
from models import FinanceNote

router = APIRouter(prefix="/ingest", tags=["ingest"])


db_dependency = Annotated[Session, Depends(get_db)]


@router.post("/finance-notes", status_code=201, response_model=schemas.FinanceNoteRead)
def ingest_finance_note(
    db: db_dependency,
    finance_note_request: schemas.FinanceNoteIngest,
):
    finance_note_model = FinanceNote(**finance_note_request.model_dump())
    db.add(finance_note_model)
    db.commit()
    db.refresh(finance_note_model)
    return finance_note_model
