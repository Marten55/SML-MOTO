import 'server-only';

/**
 * Odosielanie cez Resend, ale priamo cez ich HTTP API — na jedno volanie
 * nemá zmysel ťahať ďalšiu závislosť.
 *
 * Kým nie sú kľúče, mail sa nepošle a len sa zaloguje. Nesmie to zhodiť
 * webhook: platba už prebehla a jazdec trasu vidí na obrazovke, takže
 * neodoslaný mail je nepríjemnosť, nie dôvod vracať Stripe chybu.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  if (!isMailConfigured()) {
    console.warn(
      `[mail] Preskočené — chýba RESEND_API_KEY alebo MAIL_FROM. Adresát: ${message.to}`,
    );
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      console.error(`[mail] Resend vrátil ${res.status}: ${await res.text()}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[mail] Odoslanie zlyhalo', error);
    return false;
  }
}
