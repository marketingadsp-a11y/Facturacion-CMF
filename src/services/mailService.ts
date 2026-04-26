import { AppSettings, Student } from '../types';

export const sendWelcomeEmail = async (student: Student, settings: AppSettings) => {
  if (!student.parentEmail) return;

  const subjectTemplate = settings.welcomeEmailSubject || 'Bienvenido al Portal de Padres - {colegio}';
  const bodyTemplate = settings.welcomeEmailBody || `
    <h2>¡Bienvenido al Portal de Padres!</h2>
    <p>Te damos la bienvenida al portal oficial de <strong>{colegio}</strong>.</p>
    <p>Se ha registrado el expediente del alumno: <strong>{alumno}</strong>.</p>
    <p>Para acceder al portal y consultar calificaciones, estados de cuenta y avisos, utiliza el siguiente código de registro:</p>
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; margin: 20px 0;">
      <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">{codigo}</span>
    </div>
    <p><strong>Instrucciones:</strong></p>
    <ol>
      <li>Ingresa a la plataforma de padres.</li>
      <li>Regístrate con tu correo electrónico.</li>
      <li>Ingresa el código mencionado arriba cuando se te solicite.</li>
    </ol>
  `;

  const subject = subjectTemplate
    .replace('{alumno}', `${student.name} ${student.lastName}`.toUpperCase())
    .replace('{codigo}', student.registrationCode || '')
    .replace('{colegio}', settings.schoolName);

  const body = bodyTemplate
    .replace('{alumno}', `${student.name} ${student.lastName}`.toUpperCase())
    .replace('{codigo}', student.registrationCode || '')
    .replace('{colegio}', settings.schoolName);

  try {
    const response = await fetch('/api/mail/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: student.parentEmail,
        subject,
        body
      })
    });

    if (!response.ok) {
       const err = await response.json();
       throw new Error(err.error || 'Failed to send mail');
    }
    
    console.log(`Welcome email sent to ${student.parentEmail} via backend`);
  } catch (error) {
    console.error('Error sending welcome email via backend:', error);
  }
};
