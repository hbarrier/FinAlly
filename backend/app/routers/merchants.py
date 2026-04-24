from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models.merchant import Merchant, MerchantCreate, MerchantRead, MerchantUpdate

router = APIRouter(prefix="/merchants", tags=["merchants"])

SessionDep = Annotated[Session, Depends(get_session)]


def _to_read(merchant: Merchant) -> MerchantRead:
    # TODO: replace stub with real count once Transaction model exists
    return MerchantRead(**merchant.model_dump(), transaction_count=0)


@router.get("/", response_model=list[MerchantRead])
def list_merchants(session: SessionDep):
    return [_to_read(m) for m in session.exec(select(Merchant)).all()]


@router.post("/", response_model=MerchantRead, status_code=201)
def create_merchant(body: MerchantCreate, session: SessionDep):
    merchant = Merchant.model_validate(body)
    session.add(merchant)
    session.commit()
    session.refresh(merchant)
    return _to_read(merchant)


@router.get("/{merchant_id}", response_model=MerchantRead)
def get_merchant(merchant_id: int, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    return _to_read(merchant)


@router.patch("/{merchant_id}", response_model=MerchantRead)
def update_merchant(merchant_id: int, body: MerchantUpdate, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    merchant.sqlmodel_update(body.model_dump(exclude_unset=True))
    session.commit()
    # TODO: when category_id changes, backfill transactions where category_id IS NULL
    session.refresh(merchant)
    return _to_read(merchant)


@router.delete("/{merchant_id}", status_code=204)
def delete_merchant(merchant_id: int, session: SessionDep):
    merchant = session.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")
    session.delete(merchant)
    # TODO: set transaction.merchant_id = null for all referencing transactions
    session.commit()
