from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..database import get_session
from ..models.category import Category, CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])

SessionDep = Annotated[Session, Depends(get_session)]

DUPLICATE_NAME_MSG = "A category with that name already exists."


def _to_read(category: Category) -> CategoryRead:
    return CategoryRead(**category.model_dump(), monthly_spend=0.0, movement_count=0)


@router.get("/", response_model=list[CategoryRead])
def list_categories(session: SessionDep):
    return [_to_read(c) for c in session.exec(select(Category)).all()]


@router.post("/", response_model=CategoryRead, status_code=201)
def create_category(body: CategoryCreate, session: SessionDep):
    category = Category.model_validate(body)
    session.add(category)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME_MSG)
    session.refresh(category)
    return _to_read(category)


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, session: SessionDep):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    return _to_read(category)


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(category_id: int, body: CategoryUpdate, session: SessionDep):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    category.sqlmodel_update(body.model_dump(exclude_unset=True))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME_MSG)
    session.refresh(category)
    return _to_read(category)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, session: SessionDep):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    session.delete(category)
    session.commit()
