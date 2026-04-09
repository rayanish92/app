from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = 'user'


class ConsumerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ''
    land_bigha: float = 0.0
    land_katha: float = 0.0


class BillCreate(BaseModel):
    consumer_id: str
    land_used_bigha: float
    land_used_katha: float
    billing_period: str


class PaymentCreate(BaseModel):
    bill_id: str
    amount: float
    payment_method: str = 'cash'
    notes: Optional[str] = ''
