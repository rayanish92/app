import requests
import sys
from datetime import datetime
import json

class WaterBillAPITester:
    def __init__(self, base_url="https://farm-water-tracker-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.created_consumer_id = None
        self.created_bill_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, check_response=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Additional response checks
                if check_response and response.status_code < 400:
                    try:
                        response_data = response.json()
                        if not check_response(response_data):
                            print(f"⚠️  Response validation failed")
                            success = False
                    except:
                        pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.status_code >= 400:
                    try:
                        error_detail = response.json().get('detail', 'No error detail')
                        print(f"   Error: {error_detail}")
                    except:
                        print(f"   Response: {response.text[:200]}")

            return success, response.json() if response.status_code < 400 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@waterbill.com", "password": "admin123"},
            check_response=lambda r: 'email' in r and r['email'] == 'admin@waterbill.com'
        )
        return success

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/auth/me",
            200,
            check_response=lambda r: 'email' in r and 'role' in r
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "api/dashboard/stats",
            200,
            check_response=lambda r: all(key in r for key in ['total_consumers', 'total_bills', 'total_amount', 'total_paid', 'total_due'])
        )
        return success

    def test_get_consumers(self):
        """Test get consumers list"""
        success, response = self.run_test(
            "Get Consumers",
            "GET",
            "api/consumers",
            200,
            check_response=lambda r: isinstance(r, list)
        )
        return success

    def test_create_consumer(self):
        """Test create consumer"""
        consumer_data = {
            "name": f"Test Consumer {datetime.now().strftime('%H%M%S')}",
            "phone": "+1234567890",
            "address": "Test Address",
            "land_bigha": 2.5,
            "land_katha": 10.0
        }
        
        success, response = self.run_test(
            "Create Consumer",
            "POST",
            "api/consumers",
            200,
            data=consumer_data,
            check_response=lambda r: 'id' in r and r['name'] == consumer_data['name']
        )
        
        if success and 'id' in response:
            self.created_consumer_id = response['id']
            print(f"   Created consumer ID: {self.created_consumer_id}")
        
        return success

    def test_update_consumer(self):
        """Test update consumer"""
        if not self.created_consumer_id:
            print("❌ No consumer ID available for update test")
            return False
            
        update_data = {
            "name": "Updated Test Consumer",
            "phone": "+1234567890",
            "address": "Updated Address",
            "land_bigha": 3.0,
            "land_katha": 15.0
        }
        
        success, response = self.run_test(
            "Update Consumer",
            "PUT",
            f"api/consumers/{self.created_consumer_id}",
            200,
            data=update_data
        )
        return success

    def test_rate_config(self):
        """Test rate configuration"""
        # Get current config
        success, response = self.run_test(
            "Get Rate Config",
            "GET",
            "api/rate-config",
            200,
            check_response=lambda r: 'rate_per_bigha' in r and 'katha_to_bigha_ratio' in r
        )
        
        if not success:
            return False
            
        # Update config
        new_config = {
            "rate_per_bigha": 150.0,
            "katha_to_bigha_ratio": 25.0
        }
        
        success, response = self.run_test(
            "Update Rate Config",
            "PUT",
            "api/rate-config",
            200,
            data=new_config
        )
        return success

    def test_create_bill(self):
        """Test create bill"""
        if not self.created_consumer_id:
            print("❌ No consumer ID available for bill creation")
            return False
            
        bill_data = {
            "consumer_id": self.created_consumer_id,
            "land_used_bigha": 1.0,
            "land_used_katha": 5.0,
            "billing_period": f"Test Period {datetime.now().strftime('%m/%Y')}"
        }
        
        success, response = self.run_test(
            "Create Bill",
            "POST",
            "api/bills",
            200,
            data=bill_data,
            check_response=lambda r: 'id' in r and 'amount' in r and r['amount'] > 0
        )
        
        if success and 'id' in response:
            self.created_bill_id = response['id']
            print(f"   Created bill ID: {self.created_bill_id}")
            print(f"   Bill amount: ₹{response.get('amount', 0)}")
        
        return success

    def test_get_bills(self):
        """Test get bills list"""
        success, response = self.run_test(
            "Get Bills",
            "GET",
            "api/bills",
            200,
            check_response=lambda r: isinstance(r, list)
        )
        return success

    def test_create_payment(self):
        """Test create payment"""
        if not self.created_bill_id:
            print("❌ No bill ID available for payment creation")
            return False
            
        payment_data = {
            "bill_id": self.created_bill_id,
            "amount": 50.0,
            "payment_method": "cash",
            "notes": "Test payment"
        }
        
        success, response = self.run_test(
            "Create Payment",
            "POST",
            "api/payments",
            200,
            data=payment_data,
            check_response=lambda r: 'id' in r and r['amount'] == payment_data['amount']
        )
        return success

    def test_get_payments(self):
        """Test get payments list"""
        success, response = self.run_test(
            "Get Payments",
            "GET",
            "api/payments",
            200,
            check_response=lambda r: isinstance(r, list)
        )
        return success

    def test_send_sms(self):
        """Test SMS sending"""
        if not self.created_consumer_id:
            print("❌ No consumer ID available for SMS test")
            return False
            
        sms_data = {
            "consumer_id": self.created_consumer_id,
            "message": "Test SMS message for water bill notification"
        }
        
        success, response = self.run_test(
            "Send SMS",
            "POST",
            "api/sms/send",
            200,
            data=sms_data,
            check_response=lambda r: 'message' in r
        )
        return success

    def test_delete_bill(self):
        """Test delete bill"""
        if not self.created_bill_id:
            print("❌ No bill ID available for deletion")
            return False
            
        success, response = self.run_test(
            "Delete Bill",
            "DELETE",
            f"api/bills/{self.created_bill_id}",
            200
        )
        return success

    def test_delete_consumer(self):
        """Test delete consumer"""
        if not self.created_consumer_id:
            print("❌ No consumer ID available for deletion")
            return False
            
        success, response = self.run_test(
            "Delete Consumer",
            "DELETE",
            f"api/consumers/{self.created_consumer_id}",
            200
        )
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "api/auth/logout",
            200
        )
        return success

def main():
    print("🚀 Starting Agricultural Water Bill API Tests")
    print("=" * 50)
    
    tester = WaterBillAPITester()
    
    # Test sequence
    test_sequence = [
        ("Authentication", [
            tester.test_login,
            tester.test_get_me,
        ]),
        ("Dashboard", [
            tester.test_dashboard_stats,
        ]),
        ("Consumer Management", [
            tester.test_get_consumers,
            tester.test_create_consumer,
            tester.test_update_consumer,
        ]),
        ("Rate Configuration", [
            tester.test_rate_config,
        ]),
        ("Bill Management", [
            tester.test_create_bill,
            tester.test_get_bills,
        ]),
        ("Payment Management", [
            tester.test_create_payment,
            tester.test_get_payments,
        ]),
        ("SMS Functionality", [
            tester.test_send_sms,
        ]),
        ("Cleanup", [
            tester.test_delete_bill,
            tester.test_delete_consumer,
            tester.test_logout,
        ])
    ]
    
    failed_tests = []
    
    for category, tests in test_sequence:
        print(f"\n📋 {category} Tests")
        print("-" * 30)
        
        for test_func in tests:
            try:
                success = test_func()
                if not success:
                    failed_tests.append(f"{category}: {test_func.__name__}")
            except Exception as e:
                print(f"❌ {test_func.__name__} failed with exception: {str(e)}")
                failed_tests.append(f"{category}: {test_func.__name__}")
                tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   • {test}")
    else:
        print("\n✅ All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())