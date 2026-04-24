from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.transaction import Transaction, TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])

SessionDep = Annotated[Session, Depends(get_session)]


def _to_read(txn: Transaction) -> TransactionRead:
    return TransactionRead(**txn.model_dump())


@router.get("/", response_model=list[TransactionRead])
def list_transactions(session: SessionDep):
    return [_to_read(t) for t in session.exec(select(Transaction).order_by(Transaction.date.desc())).all()]


@router.post("/", response_model=TransactionRead, status_code=201)
def create_transaction(body: TransactionCreate, session: SessionDep):
    txn = Transaction.model_validate(body)
    session.add(txn)
    session.commit()
    session.refresh(txn)
    return _to_read(txn)


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: int, session: SessionDep):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return _to_read(txn)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(transaction_id: int, body: TransactionUpdate, session: SessionDep):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    txn.sqlmodel_update(body.model_dump(exclude_unset=True))
    session.commit()
    session.refresh(txn)
    return _to_read(txn)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, session: SessionDep):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    session.delete(txn)
    session.commit()
