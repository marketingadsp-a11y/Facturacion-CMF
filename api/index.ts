import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

const db = admin.firestore();

const app = express();
const PORT = 3000;

app.use(express.json());

// Facturapi Proxy Endpoint
app.post('/api/facturapi/invoice', async (req, res) => {
  let { apiKey, invoiceData } = req.body;
  
  if (!apiKey) {
    try {
      const settingsSnap = await db.collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        apiKey = settingsSnap.data()?.facturapiApiKey;
      }
    } catch (e) {
      console.error('Error fetching settings from Firestore:', e);
    }
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'La clave API de Facturapi no está configurada.' });
  }

  try {
    const response = await fetch('https://www.facturapi.io/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Respuesta no válida de Facturapi (no es JSON): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(data.message || `Error de Facturapi (${response.status}): ${JSON.stringify(data)}`);
    }

    res.json(data);
  } catch (error: any) {
    console.error('Facturapi Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for downloading PDF
app.get('/api/facturapi/invoice/:id/pdf', async (req, res) => {
  const { id } = req.params;
  let apiKey = req.query.apiKey as string;

  if (!apiKey) {
    try {
      const settingsSnap = await db.collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        apiKey = settingsSnap.data()?.facturapiApiKey;
      }
    } catch (e) {
      console.error('Error fetching settings from Firestore:', e);
    }
  }

  console.log(`[PDF Proxy] Iniciando descarga para factura: ${id}`);

  if (!apiKey) {
    console.error('[PDF Proxy] Error: API Key no proporcionada');
    return res.status(400).send('La clave API no está configurada.');
  }

  try {
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
    const response = await fetch(`https://www.facturapi.io/v2/invoices/${id}/pdf`, {
      headers: {
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[PDF Proxy] Error de Facturapi (${response.status}):`, text);
      return res.status(response.status).send(`Error al obtener PDF de Facturapi: ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[PDF Proxy] PDF obtenido con éxito. Tamaño: ${buffer.length} bytes`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${id}.pdf`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.send(buffer);
  } catch (error: any) {
    console.error('[PDF Proxy] Error crítico:', error);
    return res.status(500).send(`Error interno al procesar el PDF: ${error.message}`);
  }
});

// Conekta Checkout Endpoint
app.post('/api/conekta/checkout', async (req, res) => {
  const { studentName, amount, concept, email, phone } = req.body;
  
  let privateKey = process.env.CONEKTA_PRIVATE_KEY;

  if (!privateKey) {
    try {
      const settingsSnap = await db.collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        privateKey = settingsSnap.data()?.conektaPrivateKey;
      }
    } catch (e) {
      console.error('Error fetching settings from Firestore:', e);
    }
  }

  if (!privateKey) {
    return res.status(500).json({ error: 'La clave privada de Conekta no está configurada en los ajustes del sistema.' });
  }

  try {
    const response = await fetch('https://api.conekta.io/orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.conekta-v2.1.0+json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(privateKey + ':').toString('base64')}`
      },
      body: JSON.stringify({
        currency: 'MXN',
        customer_info: {
          name: studentName,
          email: email || 'cliente@ejemplo.com',
          phone: phone || '+525555555555'
        },
        line_items: [{
          name: concept,
          unit_price: Math.round(amount * 100), // Conekta uses cents
          quantity: 1
        }],
        checkout: {
          allowed_payment_methods: ['card', 'cash', 'bank_transfer'],
          type: 'HostedCheckout',
          success_url: `${process.env.APP_URL}/parent-dashboard?payment=success`,
          failure_url: `${process.env.APP_URL}/parent-dashboard?payment=failure`,
          monthly_installments_enabled: false,
          redirection_time: 3
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details?.[0]?.message || data.message || 'Error al crear la orden en Conekta');
    }

    res.json({ 
      checkout_url: data.checkout?.url,
      order_id: data.id 
    });
  } catch (error: any) {
    console.error('Conekta Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Conekta Verify Endpoint
app.get('/api/conekta/verify/:orderId', async (req, res) => {
  const { orderId } = req.params;
  
  let privateKey = process.env.CONEKTA_PRIVATE_KEY;

  if (!privateKey) {
    try {
      const settingsSnap = await db.collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        privateKey = settingsSnap.data()?.conektaPrivateKey;
      }
    } catch (e) {
      console.error('Error fetching settings from Firestore:', e);
    }
  }

  if (!privateKey) {
    return res.status(500).json({ error: 'La clave privada de Conekta no está configurada en los ajustes del sistema.' });
  }

  try {
    const response = await fetch(`https://api.conekta.io/orders/${orderId}`, {
      headers: {
        'Accept': 'application/vnd.conekta-v2.1.0+json',
        'Authorization': `Basic ${Buffer.from(privateKey + ':').toString('base64')}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al consultar la orden en Conekta');
    }

    res.json({ 
      status: data.payment_status, // 'paid', 'pending_payment', etc.
      amount: data.amount / 100
    });
  } catch (error: any) {
    console.error('Conekta Verify Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all for undefined API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.url}` });
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // En Vercel, esto puede no ser necesario si usas rewrites en vercel.json
      // pero lo dejamos como fallback
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath);
    });
  }
}

setupVite();

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
