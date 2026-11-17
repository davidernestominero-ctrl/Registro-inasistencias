// Función intermediaria de Netlify: el navegador llama a este endpoint
// del mismo sitio y esta función comunica el formulario con Apps Script.
// IMPORTANTE: sustituya la URL por la URL /exec de la implementación actualizada.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxfm1dFPuzw-J7Xba2KTHS0uFJhjxdZ7z8k5BpwSDMHdvcUPi-J1XsX8h-6-5ZkA07g/exec';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ status: 'error', message: 'Método no permitido.' }) };
  }
  try {
    if (!APPS_SCRIPT_URL.startsWith('https://script.google.com/macros/s/')) {
      throw new Error('Configure APPS_SCRIPT_URL en netlify/functions/registrar.js con la URL /exec de Apps Script.');
    }
    const datos = JSON.parse(event.body || '{}');
    if (!datos.estudiante || !datos.telefono || !datos.fecha || !datos.motivo) {
      return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Complete nombre, teléfono, fecha y motivo.' }) };
    }
    const telefono = String(datos.telefono).trim();
    const normalizado = telefono.replace(/[\s-]/g, '').replace(/^\+?503/, '');
    if (!/^[267][0-9]{7}$/.test(normalizado)) {
      return { statusCode: 400, headers, body: JSON.stringify({ status: 'error', message: 'Ingrese un teléfono salvadoreño válido de 8 dígitos (puede incluir +503).' }) };
    }
    datos.telefono = telefono;
    const respuesta = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos),
      redirect: 'follow'
    });
    const texto = await respuesta.text();
    let resultado;
    try { resultado = JSON.parse(texto); }
    catch { throw new Error('Apps Script no devolvió JSON. Verifique la implementación como aplicación web.'); }
    return {
      statusCode: respuesta.ok && resultado.status === 'success' ? 200 : 400,
      headers,
      body: JSON.stringify(resultado)
    };
  } catch (error) {
    return { statusCode: 502, headers, body: JSON.stringify({ status: 'error', message: error.message || 'No fue posible comunicarse con Apps Script.' }) };
  }
};
