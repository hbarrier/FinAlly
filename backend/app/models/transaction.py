import enum
from datetime import date as DateType

from sqlmodel import Field, SQLModel


class TransactionKind(str, enum.Enum):
    expense = "expense"
    income = "income"


class TransactionBase(SQLModel):
    date: DateType
    amount: float
    kind: TransactionKind
    category_id: int = Field(foreign_key="category.id")
    merchant_id: int | None = Field(default=None, foreign_key="merchant.id")
    note: str | None = None
    cleared: bool = Field(default=False)


class Transaction(TransactionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(SQLModel):
    date: DateType | None = None
    amount: float | None = None
    kind: TransactionKind | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    note: str | None = None
    cleared: bool | None = None


class TransactionRead(TransactionBase):
    id: int
