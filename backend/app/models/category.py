import enum

from sqlmodel import Field, SQLModel


class CategoryKind(str, enum.Enum):
    expense = "expense"
    income = "income"


class CategoryBase(SQLModel):
    name: str = Field(index=True, unique=True)
    icon: str = Field(default="Tag")
    color: str = Field(default="teal")


class Category(CategoryBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    kind: CategoryKind


class CategoryCreate(CategoryBase):
    kind: CategoryKind


class CategoryUpdate(SQLModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None


class CategoryRead(CategoryBase):
    id: int
    kind: CategoryKind
    monthly_spend: float = 0.0
    movement_count: int = 0
