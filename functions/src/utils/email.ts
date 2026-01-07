import sgMail from '@sendgrid/mail';

export function initSendgrid(apiKey: string) {
  sgMail.setApiKey(apiKey);
}

export async function sendEmail(params: {
  to: string;
  from: string;
  subject: string;
  text: string;
}): Promise<void> {
  await sgMail.send({
    to: params.to,
    from: params.from,
    subject: params.subject,
    text: params.text
  });
}
