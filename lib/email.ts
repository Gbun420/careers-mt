import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailParams {
  to: string;
  subject: string;
  template: 'application_confirmation' | 'employer_notification' | 'interview_invitation';
  data: Record<string, any>;
}

export async function sendTemplatedEmail(params: EmailParams) {
  const templates = {
    application_confirmation: (data: any) => ({
      subject: `Application Received for ${data.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Application Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h1 style="color: #2563eb;">Thank you for your application!</h1>
            <p>Hello ${data.candidateName},</p>
            <p>We've received your application for <strong>${data.jobTitle}</strong>${data.companyName ? ` at <strong>${data.companyName}</strong>` : ''}.</p>
            <p>As part of our Anti-Ghosting Guarantee, you'll hear back from the employer within 14 days.</p>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>What to expect next:</h3>
              <ul>
                <li>📅 Review phase: 2-5 business days</li>
                <li>📞 Interview scheduling: If selected</li>
                <li>📊 Status updates: Available in your dashboard</li>
              </ul>
            </div>
            <p>Best regards,<br>The Careers.mt Team</p>
          </div>
        </body>
        </html>
      `
    }),
    employer_notification: (data: any) => ({
      subject: `New Application for ${data.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Application</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h1 style="color: #2563eb;">New Job Application</h1>
            <p>Hello,</p>
            <p><strong>${data.candidateName}</strong> has applied for <strong>${data.jobTitle}</strong>.</p>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Application Details:</h3>
              <p><strong>Position:</strong> ${data.jobTitle}</p>
              <p><strong>Applicant:</strong> ${data.candidateName}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <p style="margin-top: 25px;">
              <a href="https://careersmt.vercel.app/#dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View applications in your dashboard</a>
            </p>
            <p style="margin-top: 25px;">Best regards,<br>The Careers.mt Team</p>
          </div>
        </body>
        </html>
      `
    }),
    interview_invitation: (data: any) => ({
      subject: `Interview Invitation: ${data.jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Interview Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h1 style="color: #2563eb;">Great news!</h1>
            <p>Hello,</p>
            <p>Your application for <strong>${data.jobTitle}</strong> has been moved to the interview stage.</p>
            <p>The employer will reach out to you shortly to schedule a time for your first round.</p>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Prepare for success:</h3>
              <p>Make sure your dashboard is up to date and you have reviewed the job description.</p>
            </div>
            <p style="margin-top: 25px;">
              <a href="https://careersmt.vercel.app/#dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Check your dashboard</a>
            </p>
            <p style="margin-top: 25px;">Best regards,<br>The Careers.mt Team</p>
          </div>
        </body>
        </html>
      `
    })
  };

  try {
    const template = templates[params.template](params.data);
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'notifications@careers.mt',
      to: params.to,
      subject: template.subject,
      html: template.html
    });
    return { success: true, messageId: (result.data as any)?.id || '' };

  } catch (error: any) {
    console.error(`Email sending failed (${params.template}):`, error);
    return { success: false, error: error.message };
  }
}

// Convenience functions
export async function sendApplicationConfirmation(
  candidateEmail: string,
  jobTitle: string,
  candidateName: string,
  companyName?: string
) {
  return sendTemplatedEmail({
    to: candidateEmail,
    subject: '',
    template: 'application_confirmation',
    data: { jobTitle, candidateName, companyName }
  });
}

export async function sendEmployerNotification(
  employerEmail: string,
  jobTitle: string,
  candidateName: string
) {
  return sendTemplatedEmail({
    to: employerEmail,
    subject: '',
    template: 'employer_notification',
    data: { jobTitle, candidateName }
  });
}

export async function sendInterviewConfirmation(
  candidateEmail: string,
  jobTitle: string
) {
  return sendTemplatedEmail({
    to: candidateEmail,
    subject: '',
    template: 'interview_invitation',
    data: { jobTitle }
  });
}
