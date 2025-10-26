# AWS SES Setup Guide for LiteDesk CRM

## 🎯 Why AWS SES for Your CRM?

### Perfect for Your Use Case (NOT for campaigns):
- ✅ **Transactional emails** (password resets, notifications)
- ✅ **Customer communication** (send from contact/deal records)
- ✅ **Email templates** (professional, consistent messages)
- ✅ **Email tracking** (link to CRM records)
- ✅ **Cost-effective** ($0.10 per 1,000 emails after free tier)
- ✅ **High deliverability** (not marked as spam)
- ✅ **Production ready** (used by millions)

### What You'll Be Able To Do:
1. Send emails directly from contact details
2. Use pre-built templates (welcome, follow-up, etc.)
3. Track email opens and clicks
4. Automatic notifications (task assigned, deal updated)
5. Password reset emails
6. Invoice/receipt emails (when you add Stripe)

---

## 📋 Step-by-Step AWS SES Setup

### Step 1: Create AWS Account (if you don't have one)

1. Go to: https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Complete registration (credit card required, but SES has generous free tier)

**Free Tier Benefits:**
- 62,000 emails/month for first 12 months
- Then $0.10 per 1,000 emails (very cheap!)

---

### Step 2: Set Up AWS SES

#### A. Access SES Console
1. Log into AWS Console: https://console.aws.amazon.com/
2. Search for "SES" or go to: https://console.aws.amazon.com/ses/
3. **Choose region:** `us-east-1` (recommended) or your preferred region
   - Note: Remember this region, you'll need it in `.env`

#### B. Verify Your Email Address (for testing)
1. In SES Dashboard, click **"Email Addresses"** (left sidebar)
2. Click **"Verify a New Email Address"**
3. Enter your email (e.g., `your-email@gmail.com`)
4. Check your inbox and click verification link
5. Status should show "verified" ✅

#### C. Verify Your Domain (for production)
**Important:** For production, verify your actual domain (e.g., `yourdomain.com`)

1. Click **"Domains"** in left sidebar
2. Click **"Verify a New Domain"**
3. Enter your domain: `yourdomain.com`
4. Check **"Generate DKIM Settings"** ✅
5. Click **"Verify This Domain"**

6. **Add DNS Records** (in your domain registrar):
   AWS will show you DNS records to add. Example:
   ```
   TXT _amazonses.yourdomain.com → "verification-code-here"
   
   CNAME records for DKIM (3 records):
   dkim1._domainkey.yourdomain.com → dkim1.xxxxx.dkim.amazonses.com
   dkim2._domainkey.yourdomain.com → dkim2.xxxxx.dkim.amazonses.com
   dkim3._domainkey.yourdomain.com → dkim3.xxxxx.dkim.amazonses.com
   ```

7. Wait for verification (can take up to 72 hours, usually < 30 minutes)

#### D. Request Production Access (IMPORTANT!)
By default, SES is in **"Sandbox Mode"** - you can only send to verified emails.

**To send to any email (customers):**
1. In SES Dashboard, click **"Sending Statistics"**
2. You'll see a banner: **"Your account is in the sandbox"**
3. Click **"Request Production Access"**
4. Fill out the form:
   - **Use case:** Transactional emails for CRM (customer communication, notifications)
   - **Website URL:** Your LiteDesk URL
   - **Describe use case:** "We send transactional emails from our CRM system including customer notifications, password resets, and direct communication from our sales team. We do NOT send marketing campaigns or bulk emails."
   - **Process bounces/complaints:** Yes, we monitor bounces via SES dashboard
5. Submit (usually approved within 24 hours)

---

### Step 3: Create IAM User for SES Access

**Why:** You need API credentials to send emails from your app.

1. Go to IAM Console: https://console.aws.amazon.com/iam/
2. Click **"Users"** → **"Add users"**
3. Username: `litedesk-ses-user`
4. Access type: ✅ **"Access key - Programmatic access"**
5. Click **"Next: Permissions"**

#### Attach Policy:
6. Click **"Attach existing policies directly"**
7. Search for: `AmazonSESFullAccess`
8. Check the box ✅
9. Click **"Next: Tags"** (skip tags)
10. Click **"Next: Review"**
11. Click **"Create user"**

#### Save Credentials:
12. **IMPORTANT:** Save these credentials (you won't see them again!)
    ```
    Access Key ID: AKIAIOSFODNN7EXAMPLE
    Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    ```
13. Copy these to your `.env` file (see Step 4)

---

### Step 4: Configure LiteDesk

#### Update `server/.env`:

```bash
# -----------------------------------------------------------------------------
# EMAIL CONFIGURATION (AWS SES)
# -----------------------------------------------------------------------------
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SES_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=LiteDesk CRM
EMAIL_REPLY_TO=support@yourdomain.com

# Redis for email queue (optional but recommended)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Enable email notifications
ENABLE_EMAIL_NOTIFICATIONS=true
```

**Notes:**
- Replace `AKIAIOSFODNN7EXAMPLE` with your actual Access Key ID
- Replace `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` with your Secret Key
- Replace `yourdomain.com` with your verified domain
- If in sandbox mode, use your verified email address for `EMAIL_FROM`

---

### Step 5: Install Dependencies

```bash
cd server
npm install @aws-sdk/client-ses nodemailer nodemailer-ses-transport
```

Optional (for email queue - recommended):
```bash
npm install bull redis
```

---

### Step 6: Test Email Sending

Create a test script: `server/test-email.js`

```javascript
const AWS = require('@aws-sdk/client-ses');
const nodemailer = require('nodemailer');
require('dotenv').config();

const ses = new AWS.SES({
  apiVersion: '2010-12-01',
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
});

const transporter = nodemailer.createTransport({
  SES: { ses, aws: AWS },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: 'your-test-email@gmail.com', // Change this!
      subject: 'Test Email from LiteDesk CRM',
      text: 'This is a test email from your LiteDesk CRM!',
      html: '<h1>Success!</h1><p>Your AWS SES is working! 🎉</p>',
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

testEmail();
```

Run the test:
```bash
node test-email.js
```

**Expected output:**
```
✅ Email sent successfully!
Message ID: 0100018c-xxxxx-xxxxx-xxxxx-xxxxxxxxxxxx
```

---

## 🚀 Email Service Implementation

### Basic Email Service

Create `server/services/emailService.js`:

```javascript
const AWS = require('@aws-sdk/client-ses');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    if (!process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      console.log('📧 Email notifications disabled');
      this.enabled = false;
      return;
    }

    this.enabled = true;
    
    const ses = new AWS.SES({
      apiVersion: '2010-12-01',
      region: process.env.AWS_SES_REGION,
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      },
    });

    this.transporter = nodemailer.createTransport({
      SES: { ses, aws: AWS },
    });

    console.log('✅ Email service initialized (AWS SES)');
  }

  async sendEmail({ to, subject, text, html, attachments = [] }) {
    if (!this.enabled) {
      console.log('📧 Email disabled, skipping:', subject);
      return { success: false, message: 'Email disabled' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        replyTo: process.env.EMAIL_REPLY_TO,
        to,
        subject,
        text,
        html,
        attachments,
      });

      console.log('✅ Email sent:', subject, 'to', to);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email error:', error);
      return { success: false, error: error.message };
    }
  }

  // Predefined email templates
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to LiteDesk CRM!',
      html: `
        <h1>Welcome ${user.name}!</h1>
        <p>Thank you for joining LiteDesk CRM.</p>
        <p>Get started by logging in: <a href="${process.env.CLIENT_URL}">Login Here</a></p>
      `,
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async sendTaskAssignmentEmail(user, task) {
    return this.sendEmail({
      to: user.email,
      subject: `New Task Assigned: ${task.title}`,
      html: `
        <h1>New Task Assigned</h1>
        <p><strong>${task.title}</strong></p>
        <p>${task.description}</p>
        <p>Due: ${task.dueDate}</p>
        <p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>
      `,
    });
  }

  async sendDealNotification(user, deal, action) {
    return this.sendEmail({
      to: user.email,
      subject: `Deal ${action}: ${deal.name}`,
      html: `
        <h1>Deal Update</h1>
        <p>Deal: <strong>${deal.name}</strong></p>
        <p>Action: ${action}</p>
        <p>Value: $${deal.value}</p>
        <p><a href="${process.env.CLIENT_URL}/deals/${deal._id}">View Deal</a></p>
      `,
    });
  }
}

module.exports = new EmailService();
```

### Usage in Your Code

```javascript
const emailService = require('./services/emailService');

// Send custom email
await emailService.sendEmail({
  to: 'customer@example.com',
  subject: 'Thanks for your inquiry',
  html: '<p>We received your message...</p>',
});

// Use template
await emailService.sendWelcomeEmail(newUser);
await emailService.sendPasswordResetEmail(user, resetToken);
await emailService.sendTaskAssignmentEmail(user, task);
```

---

## 📊 Monitoring & Best Practices

### Check SES Statistics
1. Go to SES Console → "Sending Statistics"
2. Monitor:
   - Emails sent
   - Bounce rate (keep < 5%)
   - Complaint rate (keep < 0.1%)

### Handle Bounces
If bounce rate is high:
1. Remove invalid emails from your database
2. Use SES bounce notifications (SNS)
3. Implement email validation

### Email Best Practices
✅ **DO:**
- Use clear, descriptive subject lines
- Include unsubscribe link (for notifications)
- Monitor bounce/complaint rates
- Test emails before sending
- Use templates for consistency

❌ **DON'T:**
- Send marketing campaigns (use SendGrid/Mailchimp instead)
- Send to unverified emails in sandbox
- Ignore bounce notifications
- Use all caps or excessive punctuation
- Send too frequently

---

## 🔧 Troubleshooting

### Error: "Email address is not verified"
- **Solution:** You're in sandbox mode. Either verify recipient email or request production access.

### Error: "Invalid credentials"
- **Solution:** Check `AWS_SES_ACCESS_KEY_ID` and `AWS_SES_SECRET_ACCESS_KEY` in `.env`

### Error: "Region not configured"
- **Solution:** Set `AWS_SES_REGION` in `.env` (e.g., `us-east-1`)

### Emails going to spam
- **Solution:**
  1. Verify your domain with DKIM
  2. Add SPF record: `v=spf1 include:amazonses.com ~all`
  3. Use professional email content (avoid spam words)
  4. Warm up your sending (start slow, increase gradually)

### High bounce rate
- **Solution:**
  1. Validate emails before sending
  2. Remove invalid emails from database
  3. Use double opt-in for signups

---

## 💰 Cost Estimation

### Example Scenarios:

**Small business (10 employees, 100 customers):**
- ~2,000 emails/month
- Cost: **FREE** (under 62k limit)

**Growing startup (50 employees, 1,000 customers):**
- ~10,000 emails/month
- Cost: **FREE** (under 62k limit)

**Established business (200 employees, 10,000 customers):**
- ~100,000 emails/month
- Cost: **$10/month** ($0.10 per 1,000)

**Much cheaper than:**
- SendGrid: $15-90/month
- Mailgun: $35/month
- Mailchimp: $20-300/month

---

## 🎯 Next Steps

1. ✅ Complete AWS SES setup (above)
2. ✅ Add credentials to `.env`
3. ✅ Install dependencies
4. ✅ Test with `test-email.js`
5. ✅ Implement email service
6. ✅ Add email endpoints to API
7. ✅ Build email UI in frontend
8. ✅ Monitor SES dashboard regularly

---

## 📚 Additional Resources

- AWS SES Documentation: https://docs.aws.amazon.com/ses/
- AWS SES Pricing: https://aws.amazon.com/ses/pricing/
- Nodemailer Docs: https://nodemailer.com/
- Email Best Practices: https://aws.amazon.com/ses/best-practices/

---

## Need Help?

If you encounter issues:
1. Check SES console for error messages
2. Review CloudWatch logs (if configured)
3. Test with AWS CLI: `aws ses send-email --to test@example.com ...`
4. Check your `.env` configuration
5. Verify your account is not in sandbox mode

**Common AWS SES Issues:**
- https://aws.amazon.com/premiumsupport/knowledge-center/ses-email-delivery-failures/

