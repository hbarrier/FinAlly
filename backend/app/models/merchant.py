from sqlmodel import Field, SQLModel


class MerchantBase(SQLModel):
    name: str = Field(index=True)
    comment: str | None = None
    category_id: int | None = Field(default=None, foreign_key="category.id")
    is_active: bool = Field(default=True)


class Merchant(MerchantBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class MerchantCreate(MerchantBase):
    pass


class MerchantUpdate(SQLModel):
    name: str | None = None
    comment: str | None = None
    category_id: int | None = None
    is_active: bool | None = None


class MerchantRead(MerchantBase):
    id: int
    transaction_count: int = 0
