from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias='_id')
    email: str
    name: str
    role: str
    model_config = ConfigDict(populate_by_name=True)

class ConsumerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ''
    land_bigha: float = 0.0
    land_katha: float = 0.0

class Consumer(BaseModel):
    id: str
    name: str
    phone: str
    address: str
    land_bigha: float
    land_katha: float
    total_due: float = 0.0
    created_at: str

class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

class RateConfig(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

class BillCreate(BaseModel):
    consumer_id: str
    land_used_bigha: float
    land_used_katha: float
    billing_period: str

class Bill(BaseModel):
    id: str
    consumer_id: str
    consumer_name: str
    land_used_bigha: float
    land_used_katha: float
    total_land_in_bigha: float
    amount: float
    paid: float
    due: float
    billing_period: str
    created_at: str

class PaymentCreate(BaseModel):
    bill_id: str
    amount: float
    payment_method: str = 'cash'
    notes: Optional[str] = ''

class Payment(BaseModel):
    id: str
    bill_id: str
    consumer_id: str
    consumer_name: str
    amount: float
    payment_method: str
    notes: str
    created_at: str

class PaginatedResponse(BaseModel):
    items: List
    total: int
    skip: int
    limit: int
    has_more: bool
