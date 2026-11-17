/**
 * REGISTRO DE INASISTENCIA
 * Google Apps Script vinculado al formulario publicado en Netlify.
 * Implementar como Aplicación web: Ejecutar como "Yo" y acceso "Cualquier persona".
 */
const CONFIG = {
  ADMIN_EMAIL: 'david.ernesto.minero@clases.edu.sv',
  PHOTO_FOLDER_ID: '1YHlFQ_nOQ2MRO2FGUaFDNw738piNQcAZ',
  SPREADSHEET_ID: '1X0s_-XJM5zSeL71NNWfXV3j8YQLEJUTOhwd5uRm5mBY',
  SHEET_NAME: 'Registros inasistencias',
  FORM_TITLE: 'Registro de inasistencia',
  TIMEZONE: 'America/El_Salvador'
};

const HEADERS = [
  'Fecha y hora de registro',
  'Nombre del estudiante',
  'Teléfono del responsable',
  'Fecha de inasistencia',
  'Justificación / motivo',
  'Fotografía'
];

function doGet() {
  return json_({ status: 'success', message: CONFIG.FORM_TITLE + ' - servicio activo.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const estudiante = String(data.estudiante || '').trim();
    const telefono = String(data.telefono || '').trim();
    const fecha = String(data.fecha || '').trim();
    const motivo = String(data.motivo || '').trim();

    if (!estudiante || !telefono || !fecha || !motivo) {
      return json_({ status: 'error', message: 'Complete nombre, teléfono, fecha y motivo.' });
    }
    if (!validarTelefonoSalvadoreno_(telefono)) {
      return json_({ status: 'error', message: 'Ingrese un teléfono salvadoreño válido de 8 dígitos.' });
    }

    lock.waitLock(20000);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }

    let fotoUrl = '';
    if (data.foto) fotoUrl = guardarFotografia_(data.foto, data.nombreFoto || 'fotografia.jpg', estudiante);

    const ahora = new Date();
    sheet.appendRow([ahora, estudiante, telefono, fecha, motivo, fotoUrl]);
    const fila = sheet.getLastRow();
    sheet.getRange(fila, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

    // La notificación es secundaria: un fallo de correo no revierte el registro.
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: 'Nuevo registro de inasistencia',
        body: [
          'Se recibió un nuevo registro de inasistencia.',
          '',
          'Estudiante: ' + estudiante,
          'Teléfono: ' + telefono,
          'Fecha de inasistencia: ' + fecha,
          'Motivo: ' + motivo,
          'Fotografía: ' + (fotoUrl || 'No adjuntada'),
          '',
          'Hoja: ' + ss.getUrl()
        ].join('\n')
      });
    } catch (mailError) {
      console.error('No se pudo enviar el correo de aviso: ' + mailError.message);
    }

    return json_({ status: 'success', message: 'Registro guardado correctamente.', row: fila });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ status: 'error', message: err.message || 'No fue posible guardar el registro.' });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function validarTelefonoSalvadoreno_(telefono) {
  const normalizado = String(telefono).replace(/[\s-]/g, '').replace(/^\+?503/, '');
  return /^[267]\d{7}$/.test(normalizado);
}

function guardarFotografia_(dataUrl, nombreOriginal, estudiante) {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) throw new Error('La fotografía no tiene un formato válido.');
  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('La fotografía supera el tamaño máximo permitido de 8 MB.');

  const folder = DriveApp.getFolderById(CONFIG.PHOTO_FOLDER_ID);
  const extension = mimeType === 'image/png' ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg');
  const safeStudent = estudiante.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_').substring(0, 50);
  const stamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss');
  const baseName = String(nombreOriginal || 'fotografia').replace(/[\\/:*?"<>|]/g, '_').substring(0, 80);
  const blob = Utilities.newBlob(bytes, mimeType, stamp + '_' + safeStudent + '_' + baseName.replace(/\.[^.]+$/, '') + extension);
  const file = folder.createFile(blob);
  return file.getUrl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar manualmente una vez si se desea autorizar los servicios y validar IDs. */
function probarConfiguracion() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(CONFIG.PHOTO_FOLDER_ID);
  Logger.log('Hoja: ' + ss.getName() + ' | pestaña configurada: ' + CONFIG.SHEET_NAME);
  Logger.log('Carpeta: ' + folder.getName());
  Logger.log('Correo administrador: ' + CONFIG.ADMIN_EMAIL);
}
