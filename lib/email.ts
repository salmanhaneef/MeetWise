// lib/email.ts
import nodemailer from 'nodemailer';  // ✅ Fixed import

interface SendInvitationParams {
  to: string;
  participantName?: string;
  meetingTitle: string;
  meetingDate: Date;
  meetingDuration: number;
  meetingLink: string;
  hostName: string;
}

/* ---------------- TRANSPORTER (Gmail SMTP) ---------------- */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

/* ---------------- MAIN FUNCTION ---------------- */
export async function sendMeetingInvitation({
  to,
  participantName,
  meetingTitle,
  meetingDate,
  meetingDuration,
  meetingLink,
  hostName,
}: SendInvitationParams) {
  if (!to) {
    console.error('❌ Missing recipient email');
    return { success: false, error: 'Recipient email missing' };
  }

  const formattedDate = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = meetingDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const emailHtml = `
    <div style="font-family: Arial; max-width:600px; margin:auto;">
      <h2>📅 Meeting Invitation</h2>
      <p>Hi ${participantName || 'there'},</p>

      <p><b>${hostName}</b> invited you to:</p>

      <ul>
        <li><b>Title:</b> ${meetingTitle}</li>
        <li><b>Date:</b> ${formattedDate}</li>
        <li><b>Time:</b> ${formattedTime}</li>
        <li><b>Duration:</b> ${meetingDuration} minutes</li>
      </ul>

      <a href="${meetingLink}" 
         style="background:#667eea;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;">
         Join Meeting
      </a>

      <p style="margin-top:20px;font-size:12px;color:#666;">
        Link: ${meetingLink}
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Meeting App" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Meeting Invitation: ${meetingTitle}`,
      html: emailHtml,
      text: `Join meeting: ${meetingLink}`,
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, error };
  }
}