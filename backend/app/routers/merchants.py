from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from ..database import get_session
from ..models.merchant import Merchant, MerchantCreate, MerchantRead, MerchantUpdate
from ..models.transaction import Transaction

router = APIRouter(prefix="/merchants", tags=["merchants"])

SessionDep = Annotated[Session, Depends(get_session)]


def _to_read(merchant: Merchant, session: Session) -> MerchantRead:
    count = session.exec(
        select(func.count()).where(Transaction.merchant_id == merchant.id)
    ).one()
    return MerchantRead(**merchant.model_dump(), transaction_count=count)


@router.get("/", response_model=list[MerchantRead])
def list_merchants(session: SessionDep):
    return [_to_read(m, session) for m in session.exec(select(Merchant)).all()]


@router.post("/", response_model=MerchantRead, status_code=201)
def create_merchant(body: MerchantCreate, session: SessionDep):
    merchant = Merchant.model_validate(body)
    session.add(merchant)
    session.commit()
    session.refresh(merchant)
    return _to_read(merchant, session)


@router.get("/{merchant_id}", response_model=MerchantRead)
def get_merchant(merchant_id: int, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    return _to_read(merchant, session)


@router.patch("/{merchant_id}", response_model=MerchantRead)
def update_merchant(merchant_id: int, body: MerchantUpdate, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    merchant.sqlmodel_update(body.model_dump(exclude_unset=True))
    session.commit()
    session.refresh(merchant)
    return _to_read(merchant, session)


@router.delete("/{merchant_id}", status_code=204)
def delete_merchant(merchant_id: int, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    for txn in session.exec(select(Transaction).where(Transaction.merchant_id == merchant_id)).all():
        txn.merchant_id = None
    session.delete(merchant)
    session.commit()
