# Fast2SMS Integration Setup Guide

## What is Fast2SMS?

Fast2SMS is a **free SMS service for India** that allows you to send SMS messages to any Indian mobile number. It's perfect for:
- Water bill notifications
- Payment reminders
- Service alerts
- Emergency notifications

## Why Fast2SMS?

✅ **Free Credits** - Get free SMS credits on signup
✅ **Easy Setup** - No complex configuration needed
✅ **India-Focused** - Works with all Indian mobile numbers
✅ **DLT Compliant** - Supports DLT registration for bulk SMS
✅ **Fast Delivery** - Quick SMS delivery to consumers

---

## Step-by-Step Setup

### Step 1: Create Fast2SMS Account

1. Visit **https://www.fast2sms.com**
2. Click on **"Sign Up"** or **"Register"**
3. Fill in your details:
   - Name
   - Email address
   - Password
   - Mobile number (for verification)
4. Verify your email and mobile number
5. **You'll get FREE SMS credits** on signup for testing!

### Step 2: Get Your API Key

1. Login to your Fast2SMS account
2. Go to **"Dev API"** section in the dashboard
3. You'll see your **API Authorization Key**
4. Copy this key (it looks like: `xxxxxxxxxxxxxxxxxxx`)

**Important:** Keep this key secure and never share it publicly!

### Step 3: Add API Key to Your App

1. Open the backend environment file:
   ```bash
   /app/backend/.env
   ```

2. Find the line:
   ```
   FAST2SMS_API_KEY=""
   ```

3. Paste your API key between the quotes:
   ```
   FAST2SMS_API_KEY="your_actual_api_key_here"
   ```

4. Save the file

5. Restart the backend:
   ```bash
   sudo supervisorctl restart backend
   ```

### Step 4: Test SMS Sending

1. Open your Water Tracker app
2. Go to **SMS** tab
3. Select a consumer
4. Type a message (or use a template)
5. Click **"Send SMS"**
6. Check if SMS was delivered!

---

## Message Format

Fast2SMS supports:
- **160 characters** per SMS (standard)
- **English** language
- **Unicode** for special characters

### Sample Messages

**Bill Notification:**
```
Dear [Name], Your water bill of ₹500 is due by 30-Apr-2026. Pay now to avoid late charges.
```

**Payment Reminder:**
```
Payment Reminder: Your water bill of ₹500 is 5 days overdue. Please pay immediately.
```

**Service Alert:**
```
Service Alert: Water supply will be interrupted on 15-Apr from 10 AM for maintenance.
```

---

## SMS Routes

Fast2SMS offers different routes for different purposes:

| Route | Type | Use Case | 24/7 | DND |
|-------|------|----------|------|-----|
| `q` | Quick Transactional | Bill notifications, OTPs | ✅ | ✅ |
| `p` | Promotional | Marketing messages | ❌ | ❌ |
| `t` | Transactional | Service messages | ✅ | ✅ |

**Default route used in app:** `q` (Quick Transactional)

---

## Free vs Paid Credits

### Free Plan
- Get free credits on signup
- Good for testing and small-scale use
- Limited credits per day/month

### Paid Plans
- Starting from ₹10
- More SMS credits
- Higher sending limits
- Better delivery rates

### Check Your Balance
1. Login to Fast2SMS dashboard
2. Click on **"Wallet"**
3. See your **available credits**

---

## Troubleshooting

### SMS not sending?

**1. Check API Key**
- Make sure API key is correctly added to `.env`
- No spaces before or after the key
- Restart backend after adding key

**2. Check Credits**
- Login to Fast2SMS dashboard
- Check if you have sufficient credits
- Recharge if needed

**3. Check Phone Number**
- Must be 10 digits
- Indian mobile number only
- No country code (+91)

**4. Check Backend Logs**
```bash
tail -f /var/log/supervisor/backend.err.log
```

### Error Messages

| Error | Reason | Solution |
|-------|--------|----------|
| "Invalid API Key" | Wrong or expired key | Get new key from dashboard |
| "Insufficient Balance" | No SMS credits | Recharge account |
| "Invalid Number" | Wrong phone format | Use 10-digit number |
| "Fast2SMS not configured" | API key not set | Add key to .env |

---

## DLT Registration (For Bulk SMS)

If you're sending **promotional SMS** or **bulk messages**, you need DLT registration:

1. Visit Fast2SMS **DLT Registration** page
2. Register your:
   - **Entity** (Your organization)
   - **Sender ID** (e.g., "WTRBL")
   - **Content Templates** (Your message formats)
3. Wait for approval (1-2 days)
4. Use approved templates for SMS

**Note:** For service/transactional SMS (like bill notifications), DLT is optional but recommended.

---

## Best Practices

### ✅ Do's
- Keep messages under 160 characters
- Use clear, professional language
- Include essential info only
- Test with your own number first
- Monitor SMS delivery status
- Keep API key secure

### ❌ Don'ts
- Don't send spam messages
- Don't share API key publicly
- Don't send promotional SMS to DND numbers
- Don't exceed character limit (costs extra)
- Don't hardcode API key in code

---

## Cost Estimate

| SMS Type | Credits per SMS | Example |
|----------|----------------|---------|
| Standard SMS | 1 credit | Messages up to 160 chars |
| Long SMS | 2+ credits | Messages over 160 chars |
| Unicode SMS | 1.5 credits | Messages with special chars |

**Tip:** Keep messages concise to save credits!

---

## API Endpoints Used

The app uses Fast2SMS **Bulk SMS API**:

```
POST https://www.fast2sms.com/dev/bulkV2
```

**Headers:**
```
authorization: YOUR_API_KEY
Content-Type: application/x-www-form-urlencoded
```

**Payload:**
```
sender_id: FSTSMS
message: Your message here
route: q
numbers: 9999999999
```

---

## Support & Resources

- **Fast2SMS Website:** https://www.fast2sms.com
- **Documentation:** https://docs.fast2sms.com
- **Support:** support@fast2sms.com
- **Dashboard:** https://www.fast2sms.com/dashboard

---

## Summary

1. ✅ Create Fast2SMS account → Get free credits
2. ✅ Copy API key from Dev API section
3. ✅ Add key to `/app/backend/.env`
4. ✅ Restart backend
5. ✅ Send SMS from app!

**You're all set!** Start sending water bill notifications to your consumers via SMS. 📱💧
