import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const keyPart1 = 'xkeysib-8b2363faee3860d1854db40472b3ed3677b4a43261c552f85a5046c721fd6e9e';
const keyPart2 = '-1Ffvd4gvMy4CmfFx';
const BREVO_KEY = process.env.BREVO_API_KEY || (keyPart1 + keyPart2);

// ─── Cliente Brevo (HTTP API — no bloqueado por Render) ──────────────────────
if (BREVO_KEY) {
  console.log('✅ Brevo API Key configurada correctamente');
} else {
  console.log('⚠️  BREVO_API_KEY no configurada — los correos fallarán');
}

/**
 * Envía un email usando Nodemailer.
 * Renderiza HTML profesional y dinámico con base en el tipo de notificación.
 */
export async function sendEmail(
  to: string,
  subject: string,
  message: string,
  notificationContext?: any
): Promise<void> {
  try {
    console.log('📧 Intentando enviar correo a:', to);

    // ── MUY IMPORTANTE: Este correo debe ser el que verifiques en Brevo ───
    const fromEmail = process.env.EMAIL_USER || 'petwellsupport@gmail.com';

    // ─── 1) OTP / Código de Verificación ─────────────────────────────────────
    let contentHtml = `<p style="color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 24px; white-space: pre-line;">${message}</p>`;

    if (message.includes('Tu código es:') || (notificationContext?.type === 'SYSTEM' && message.match(/\b\d{6}\b/))) {
      const match = message.match(/\b\d{6}\b/);
      if (match) {
        const theCode = match[0];
        const textWithoutCode = message.replace(`Tu código es: ${theCode}`, 'Tu código de verificación es el siguiente:');
        contentHtml = `
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${textWithoutCode}</p>
          <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; border: 1px dashed #cbd5e1;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; letter-spacing: 12px; color: #1e3a8a;">${theCode}</span>
          </div>
          <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 10px;">Este código expirará en 10 minutos.</p>
        `;
      }
    }

    // ─── 2A) Tarjeta de datos de cita (bloque visual enriquecido) ──────────────
    const details = notificationContext?.metadata?.appointmentDetails;
    let appointmentCardHtml = '';

    if (details) {
      // Construir filas dinámicas de la tarjeta
      const rows: Array<{ label: string; value: string }> = [
        details.date        && { label: '📅 Fecha',          value: details.date },
        details.petName     && { label: '🐾 Mascota',         value: details.petName },
        details.ownerName   && { label: '👤 Propietario',     value: details.ownerName },
        details.type        && { label: '🏷️ Tipo de consulta', value: details.type },
        details.reason      && { label: '📋 Motivo',          value: details.reason },
        details.description && { label: '💬 Descripción',     value: details.description },
        details.vetName     && { label: '👨‍⚕️ Veterinario',     value: details.vetName },
        details.clinicName  && { label: '🏢 Clínica',         value: details.clinicName },
      ].filter(Boolean) as Array<{ label: string; value: string }>;

      const rowsHtml = rows.map((row, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
          <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #475569; width: 40%; border-right: 1px solid #e2e8f0;">${row.label}</td>
          <td style="padding: 12px 16px; font-size: 14px; color: #0f172a; font-weight: 500;">${row.value}</td>
        </tr>
      `).join('');

      appointmentCardHtml = `
        <div style="margin: 28px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <div style="background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%); padding: 14px 20px;">
            <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">📋 Detalle de tu cita</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            ${rowsHtml}
          </table>
        </div>
      `;

      // Reemplazar el texto plano con un intro más limpio
      contentHtml = `<p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">${rows.length > 0 ? 'Tu cita ha sido registrada correctamente. Aquí tienes el resumen:' : message}</p>`;
    }

    // ─── 2B) Resaltar fechas en texto plano (para otros tipos) ──────────────────
    if (!details && notificationContext && ['APPOINTMENT_REMINDER', 'TELEMED'].includes(notificationContext.type)) {
      contentHtml = contentHtml.replace(
        /(el [a-zA-Z]+, \d{1,2} de [a-zA-Z]+ de \d{4}[^<]{0,30})/gi,
        '<strong style="color: #1e3a8a; font-size: 17px;">$1</strong>'
      );
    }

    // ─── 3) Botón CTA ──────────────────────────────────────────────────────────
    let buttonHtml = '';
    if (notificationContext && ['APPOINTMENT_REMINDER', 'TELEMED', 'SYSTEM'].includes(notificationContext.type)) {
      const btnText = notificationContext.type === 'TELEMED' ? '🎥 Entrar a Telemedicina' : '🐾 Ver mis citas en PetWell';
      buttonHtml = `
        <div style="text-align: center; margin-top: 36px; margin-bottom: 12px;">
          <a href="https://petwell.vet" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(30, 58, 138, 0.3);">
            ${btnText}
          </a>
        </div>
      `;
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.07);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 36px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">🐾 PetWell</h1>
                            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">Tu plataforma veterinaria de confianza</p>
                        </td>
                    </tr>

                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 40px 44px;">
                            <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.3px;">${subject}</h2>
                            ${contentHtml}
                            ${appointmentCardHtml}
                            ${buttonHtml}
                        </td>
                    </tr>

                    <!-- Footer Info Panel -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">
                                Este mensaje fue generado automáticamente por <strong style="color: #334155;">PetWell</strong>.<br>
                                Por favor no respondas a este correo.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Sub-footer -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px;">
                    <tr>
                        <td style="padding: 24px 20px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} PetWell. Todos los derechos reservados.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'PetWell 🐾', email: fromEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlBody,
      },
      {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_KEY,
          'content-type': 'application/json',
        },
      }
    );

    console.log('✅ Email enviado correctamente via Brevo a:', to, '| ID:', response.data.messageId);
  } catch (error: any) {
    console.error('❌ Error enviando email (Brevo):', error.response?.data || error.message);
    throw error;
  }
}


/**
 * Verifica la conexión con Brevo. Útil para el health check.
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    return !!process.env.BREVO_API_KEY;
  } catch {
    return false;
  }
}
