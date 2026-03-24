import { sendApplicationConfirmation } from '../lib/email';
import * as dotenv from 'dotenv';
dotenv.config();

async function testEmail() {
  const testEmailAddr = process.argv[2] || 'test@example.com';
  console.log(`Sending test email to ${testEmailAddr}...`);
  
  try {
    const result = await sendApplicationConfirmation(
      testEmailAddr,
      'Senior Cloud Engineer',
      'John Doe',
      'TechCorp'
    );
    if (result.success) {
      console.log('✅ Email sent successfully! Message ID:', result.messageId);
    } else {
      console.log('❌ Email failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testEmail();
