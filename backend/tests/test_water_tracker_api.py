"""
Water Tracker API Tests
Tests for: Auth, Consumers, Bills, Payments, Rate Config, Dashboard, SMS
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://farm-water-tracker-1.preview.emergentagent.com')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@waterbill.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "email" in data
        assert data["email"] == "admin@waterbill.com"
        assert "name" in data
        assert "role" in data
        assert data["role"] == "admin"
        
        # Check cookies are set
        assert "access_token" in response.cookies
        print(f"Login successful: {data['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")
    
    def test_get_me_with_cookie(self, auth_session):
        """Test GET /api/auth/me returns user info"""
        response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        data = response.json()
        assert "email" in data
        assert data["email"] == "admin@waterbill.com"
        assert "name" in data
        assert "role" in data
        print(f"GET /me successful: {data['email']}")
    
    def test_get_me_without_auth(self):
        """Test GET /api/auth/me without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("Unauthenticated /me correctly rejected")


class TestConsumers:
    """Consumer CRUD tests with pagination"""
    
    def test_get_consumers_paginated(self, auth_session):
        """Test GET /api/consumers returns paginated format"""
        response = auth_session.get(f"{BASE_URL}/api/consumers")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data, "Response should have 'total' key"
        assert "skip" in data, "Response should have 'skip' key"
        assert "limit" in data, "Response should have 'limit' key"
        assert "has_more" in data, "Response should have 'has_more' key"
        assert isinstance(data["items"], list)
        print(f"GET consumers: {data['total']} total, {len(data['items'])} items")
    
    def test_create_consumer(self, auth_session):
        """Test POST /api/consumers creates a consumer"""
        consumer_data = {
            "name": f"{TEST_PREFIX}Consumer_{int(time.time())}",
            "phone": "9876543210",
            "address": "Test Address",
            "land_bigha": 5.0,
            "land_katha": 10.0
        }
        
        response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "_id" not in data, "Response should not contain _id"
        assert "id" in data, "Response should have 'id'"
        assert data["name"] == consumer_data["name"]
        assert data["phone"] == consumer_data["phone"]
        assert data["land_bigha"] == consumer_data["land_bigha"]
        assert data["land_katha"] == consumer_data["land_katha"]
        assert "total_due" in data
        assert "created_at" in data
        
        # Verify persistence with GET
        get_response = auth_session.get(f"{BASE_URL}/api/consumers")
        assert get_response.status_code == 200
        consumers = get_response.json()["items"]
        created = next((c for c in consumers if c["id"] == data["id"]), None)
        assert created is not None, "Created consumer not found in list"
        
        print(f"Created consumer: {data['id']}")
        return data["id"]
    
    def test_update_consumer(self, auth_session):
        """Test PUT /api/consumers/{id} updates a consumer"""
        # First create a consumer
        consumer_data = {
            "name": f"{TEST_PREFIX}UpdateTest_{int(time.time())}",
            "phone": "1234567890",
            "address": "Original Address",
            "land_bigha": 2.0,
            "land_katha": 5.0
        }
        create_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        assert create_response.status_code == 200
        consumer_id = create_response.json()["id"]
        
        # Update the consumer
        update_data = {
            "name": f"{TEST_PREFIX}UpdatedConsumer_{int(time.time())}",
            "phone": "9999999999",
            "address": "Updated Address",
            "land_bigha": 10.0,
            "land_katha": 15.0
        }
        update_response = auth_session.put(f"{BASE_URL}/api/consumers/{consumer_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Verify update with GET
        get_response = auth_session.get(f"{BASE_URL}/api/consumers")
        consumers = get_response.json()["items"]
        updated = next((c for c in consumers if c["id"] == consumer_id), None)
        assert updated is not None
        assert updated["name"] == update_data["name"]
        assert updated["phone"] == update_data["phone"]
        
        print(f"Updated consumer: {consumer_id}")
    
    def test_delete_consumer(self, auth_session):
        """Test DELETE /api/consumers/{id} deletes a consumer"""
        # First create a consumer
        consumer_data = {
            "name": f"{TEST_PREFIX}DeleteTest_{int(time.time())}",
            "phone": "5555555555",
            "address": "To Be Deleted",
            "land_bigha": 1.0,
            "land_katha": 1.0
        }
        create_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        assert create_response.status_code == 200
        consumer_id = create_response.json()["id"]
        
        # Delete the consumer
        delete_response = auth_session.delete(f"{BASE_URL}/api/consumers/{consumer_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion with GET
        get_response = auth_session.get(f"{BASE_URL}/api/consumers")
        consumers = get_response.json()["items"]
        deleted = next((c for c in consumers if c["id"] == consumer_id), None)
        assert deleted is None, "Consumer should be deleted"
        
        print(f"Deleted consumer: {consumer_id}")


class TestBills:
    """Bill CRUD tests with pagination and calculation"""
    
    def test_get_bills_paginated(self, auth_session):
        """Test GET /api/bills returns paginated format"""
        response = auth_session.get(f"{BASE_URL}/api/bills")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "has_more" in data
        print(f"GET bills: {data['total']} total, {len(data['items'])} items")
    
    def test_create_bill_with_calculation(self, auth_session):
        """Test POST /api/bills creates a bill with correct land+rate calculation"""
        # First create a consumer
        consumer_data = {
            "name": f"{TEST_PREFIX}BillConsumer_{int(time.time())}",
            "phone": "8888888888",
            "address": "Bill Test",
            "land_bigha": 5.0,
            "land_katha": 0.0
        }
        consumer_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        assert consumer_response.status_code == 200
        consumer_id = consumer_response.json()["id"]
        
        # Get rate config
        rate_response = auth_session.get(f"{BASE_URL}/api/rate-config")
        rate_config = rate_response.json()
        
        # Create bill
        bill_data = {
            "consumer_id": consumer_id,
            "land_used_bigha": 2.0,
            "land_used_katha": 10.0,
            "billing_period": "Test Period 2026"
        }
        bill_response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        assert bill_response.status_code == 200, f"Create bill failed: {bill_response.text}"
        
        bill = bill_response.json()
        assert "_id" not in bill, "Response should not contain _id"
        assert "id" in bill
        assert bill["consumer_id"] == consumer_id
        assert bill["land_used_bigha"] == 2.0
        assert bill["land_used_katha"] == 10.0
        
        # Verify calculation: total_land = bigha + (katha / ratio)
        expected_land = 2.0 + (10.0 / rate_config["katha_to_bigha_ratio"])
        assert bill["total_land_in_bigha"] == round(expected_land, 2)
        
        # Verify amount calculation: amount = total_land * rate_per_bigha
        expected_amount = expected_land * rate_config["rate_per_bigha"]
        assert bill["amount"] == round(expected_amount, 2)
        
        assert bill["paid"] == 0.0
        assert bill["due"] == bill["amount"]
        
        print(f"Created bill: {bill['id']}, amount: {bill['amount']}")
        return bill["id"], consumer_id
    
    def test_delete_bill(self, auth_session):
        """Test DELETE /api/bills/{id} deletes a bill"""
        # Create consumer and bill
        consumer_data = {
            "name": f"{TEST_PREFIX}DeleteBillConsumer_{int(time.time())}",
            "phone": "7777777777",
            "address": "Delete Bill Test",
            "land_bigha": 1.0,
            "land_katha": 0.0
        }
        consumer_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        consumer_id = consumer_response.json()["id"]
        
        bill_data = {
            "consumer_id": consumer_id,
            "land_used_bigha": 1.0,
            "land_used_katha": 0.0,
            "billing_period": "Delete Test"
        }
        bill_response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        bill_id = bill_response.json()["id"]
        
        # Delete bill
        delete_response = auth_session.delete(f"{BASE_URL}/api/bills/{bill_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = auth_session.get(f"{BASE_URL}/api/bills")
        bills = get_response.json()["items"]
        deleted = next((b for b in bills if b["id"] == bill_id), None)
        assert deleted is None, "Bill should be deleted"
        
        print(f"Deleted bill: {bill_id}")


class TestPayments:
    """Payment CRUD tests with bill updates"""
    
    def test_get_payments_paginated(self, auth_session):
        """Test GET /api/payments returns paginated format"""
        response = auth_session.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "has_more" in data
        print(f"GET payments: {data['total']} total, {len(data['items'])} items")
    
    def test_create_payment_updates_bill(self, auth_session):
        """Test POST /api/payments creates payment and updates bill due/paid"""
        # Create consumer
        consumer_data = {
            "name": f"{TEST_PREFIX}PaymentConsumer_{int(time.time())}",
            "phone": "6666666666",
            "address": "Payment Test",
            "land_bigha": 1.0,
            "land_katha": 0.0
        }
        consumer_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        consumer_id = consumer_response.json()["id"]
        
        # Create bill
        bill_data = {
            "consumer_id": consumer_id,
            "land_used_bigha": 1.0,
            "land_used_katha": 0.0,
            "billing_period": "Payment Test Period"
        }
        bill_response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        bill = bill_response.json()
        bill_id = bill["id"]
        original_amount = bill["amount"]
        
        # Create payment
        payment_amount = 500.0
        payment_data = {
            "bill_id": bill_id,
            "amount": payment_amount,
            "payment_method": "cash",
            "notes": "Test payment"
        }
        payment_response = auth_session.post(f"{BASE_URL}/api/payments", json=payment_data)
        assert payment_response.status_code == 200, f"Create payment failed: {payment_response.text}"
        
        payment = payment_response.json()
        assert "_id" not in payment, "Response should not contain _id"
        assert "id" in payment
        assert payment["amount"] == payment_amount
        assert payment["payment_method"] == "cash"
        
        # Verify bill was updated
        bills_response = auth_session.get(f"{BASE_URL}/api/bills")
        bills = bills_response.json()["items"]
        updated_bill = next((b for b in bills if b["id"] == bill_id), None)
        assert updated_bill is not None
        assert updated_bill["paid"] == payment_amount
        assert updated_bill["due"] == original_amount - payment_amount
        
        print(f"Created payment: {payment['id']}, bill updated: paid={updated_bill['paid']}, due={updated_bill['due']}")
        return payment["id"], bill_id
    
    def test_update_payment(self, auth_session):
        """Test PUT /api/payments/{id} updates a payment"""
        # Create consumer, bill, and payment
        consumer_data = {
            "name": f"{TEST_PREFIX}UpdatePaymentConsumer_{int(time.time())}",
            "phone": "4444444444",
            "address": "Update Payment Test",
            "land_bigha": 1.0,
            "land_katha": 0.0
        }
        consumer_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        consumer_id = consumer_response.json()["id"]
        
        bill_data = {
            "consumer_id": consumer_id,
            "land_used_bigha": 1.0,
            "land_used_katha": 0.0,
            "billing_period": "Update Payment Test"
        }
        bill_response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        bill_id = bill_response.json()["id"]
        
        payment_data = {
            "bill_id": bill_id,
            "amount": 100.0,
            "payment_method": "cash",
            "notes": "Original"
        }
        payment_response = auth_session.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = payment_response.json()["id"]
        
        # Update payment
        update_data = {
            "bill_id": bill_id,
            "amount": 200.0,
            "payment_method": "upi",
            "notes": "Updated"
        }
        update_response = auth_session.put(f"{BASE_URL}/api/payments/{payment_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Verify update
        payments_response = auth_session.get(f"{BASE_URL}/api/payments")
        payments = payments_response.json()["items"]
        updated = next((p for p in payments if p["id"] == payment_id), None)
        assert updated is not None
        assert updated["amount"] == 200.0
        assert updated["payment_method"] == "upi"
        
        print(f"Updated payment: {payment_id}")
    
    def test_delete_payment_reverses_bill(self, auth_session):
        """Test DELETE /api/payments/{id} reverses payment from bill"""
        # Create consumer, bill, and payment
        consumer_data = {
            "name": f"{TEST_PREFIX}DeletePaymentConsumer_{int(time.time())}",
            "phone": "3333333333",
            "address": "Delete Payment Test",
            "land_bigha": 1.0,
            "land_katha": 0.0
        }
        consumer_response = auth_session.post(f"{BASE_URL}/api/consumers", json=consumer_data)
        consumer_id = consumer_response.json()["id"]
        
        bill_data = {
            "consumer_id": consumer_id,
            "land_used_bigha": 1.0,
            "land_used_katha": 0.0,
            "billing_period": "Delete Payment Test"
        }
        bill_response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        bill = bill_response.json()
        bill_id = bill["id"]
        original_amount = bill["amount"]
        
        payment_data = {
            "bill_id": bill_id,
            "amount": 500.0,
            "payment_method": "cash",
            "notes": "To be deleted"
        }
        payment_response = auth_session.post(f"{BASE_URL}/api/payments", json=payment_data)
        payment_id = payment_response.json()["id"]
        
        # Delete payment
        delete_response = auth_session.delete(f"{BASE_URL}/api/payments/{payment_id}")
        assert delete_response.status_code == 200
        
        # Verify bill was reversed
        bills_response = auth_session.get(f"{BASE_URL}/api/bills")
        bills = bills_response.json()["items"]
        updated_bill = next((b for b in bills if b["id"] == bill_id), None)
        assert updated_bill is not None
        assert updated_bill["paid"] == 0.0
        assert updated_bill["due"] == original_amount
        
        print(f"Deleted payment: {payment_id}, bill reversed")


class TestRateConfig:
    """Rate configuration tests"""
    
    def test_get_rate_config(self, auth_session):
        """Test GET /api/rate-config returns rate config"""
        response = auth_session.get(f"{BASE_URL}/api/rate-config")
        assert response.status_code == 200
        
        data = response.json()
        assert "rate_per_bigha" in data
        assert "katha_to_bigha_ratio" in data
        assert isinstance(data["rate_per_bigha"], (int, float))
        assert isinstance(data["katha_to_bigha_ratio"], (int, float))
        
        print(f"Rate config: {data}")
    
    def test_update_rate_config(self, auth_session):
        """Test PUT /api/rate-config updates rate config"""
        # Get current config
        get_response = auth_session.get(f"{BASE_URL}/api/rate-config")
        original_config = get_response.json()
        
        # Update config
        new_config = {
            "rate_per_bigha": 2500.0,
            "katha_to_bigha_ratio": 20.0
        }
        update_response = auth_session.put(f"{BASE_URL}/api/rate-config", json=new_config)
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = auth_session.get(f"{BASE_URL}/api/rate-config")
        updated = verify_response.json()
        assert updated["rate_per_bigha"] == new_config["rate_per_bigha"]
        assert updated["katha_to_bigha_ratio"] == new_config["katha_to_bigha_ratio"]
        
        # Restore original config
        auth_session.put(f"{BASE_URL}/api/rate-config", json=original_config)
        
        print(f"Updated rate config: {new_config}")


class TestDashboard:
    """Dashboard stats tests"""
    
    def test_get_dashboard_stats(self, auth_session):
        """Test GET /api/dashboard/stats returns aggregated stats"""
        response = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_consumers" in data
        assert "total_bills" in data
        assert "total_amount" in data
        assert "total_paid" in data
        assert "total_due" in data
        
        assert isinstance(data["total_consumers"], int)
        assert isinstance(data["total_bills"], int)
        assert isinstance(data["total_amount"], (int, float))
        assert isinstance(data["total_paid"], (int, float))
        assert isinstance(data["total_due"], (int, float))
        
        print(f"Dashboard stats: {data}")


class TestSMS:
    """SMS endpoint tests (mocked)"""
    
    def test_send_sms_logs_message(self, auth_session):
        """Test POST /api/sms/send logs SMS message"""
        # Get a consumer
        consumers_response = auth_session.get(f"{BASE_URL}/api/consumers")
        consumers = consumers_response.json()["items"]
        
        if not consumers:
            pytest.skip("No consumers available for SMS test")
        
        consumer_id = consumers[0]["id"]
        
        sms_data = {
            "consumer_id": consumer_id,
            "message": "Test SMS message from automated tests"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/sms/send", json=sms_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "phone" in data
        assert "text" in data
        
        print(f"SMS logged: {data}")
    
    def test_send_sms_invalid_consumer(self, auth_session):
        """Test POST /api/sms/send with invalid consumer returns 404"""
        sms_data = {
            "consumer_id": "invalid_consumer_id",
            "message": "Test message"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/sms/send", json=sms_data)
        assert response.status_code == 404
        print("Invalid consumer SMS correctly rejected")


# Fixtures
@pytest.fixture
def auth_session():
    """Create authenticated session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@waterbill.com", "password": "admin123"}
    )
    if response.status_code != 200:
        pytest.fail(f"Authentication failed: {response.text}")
    return session


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup after tests
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@waterbill.com", "password": "admin123"}
    )
    if response.status_code == 200:
        # Get and delete test consumers
        consumers_response = session.get(f"{BASE_URL}/api/consumers")
        if consumers_response.status_code == 200:
            consumers = consumers_response.json().get("items", [])
            for consumer in consumers:
                if consumer["name"].startswith(TEST_PREFIX):
                    # First delete associated bills
                    bills_response = session.get(f"{BASE_URL}/api/bills")
                    if bills_response.status_code == 200:
                        bills = bills_response.json().get("items", [])
                        for bill in bills:
                            if bill["consumer_id"] == consumer["id"]:
                                # Delete payments first
                                payments_response = session.get(f"{BASE_URL}/api/payments")
                                if payments_response.status_code == 200:
                                    payments = payments_response.json().get("items", [])
                                    for payment in payments:
                                        if payment["bill_id"] == bill["id"]:
                                            session.delete(f"{BASE_URL}/api/payments/{payment['id']}")
                                session.delete(f"{BASE_URL}/api/bills/{bill['id']}")
                    session.delete(f"{BASE_URL}/api/consumers/{consumer['id']}")
        print("Test data cleanup completed")
