import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config safely
let firebaseConfig: any = {};
try {
  const rootConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const apiConfigPath = path.join(__dirname, '..', 'firebase-applet-config.json');
  
  if (fs.existsSync(rootConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
  } else if (fs.existsSync(apiConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(apiConfigPath, 'utf8'));
  }
} catch (e) {
  console.error('Error loading firebase-applet-config.json:', e);
}

// Initialize Firebase Client lazily for backend use
let clientDb: any;
function getDb() {
  if (!clientDb) {
    try {
      if (!firebaseConfig.projectId) {
        throw new Error('No se encontró projectId en firebase-applet-config.json');
      }
      const app = initializeClientApp(firebaseConfig);
      clientDb = getClientFirestore(app);
    } catch (e: any) {
      console.error('Error initializing Firebase Client:', e);
      throw new Error(`Error al inicializar Firebase: ${e.message}`);
    }
  }
  return clientDb;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Facturapi Proxy Endpoint
app.post('/api/facturapi/invoice', async (req, res) => {
  let { apiKey, invoiceData } = req.body;
  
  if (!apiKey) {
    let firestoreError = '';
    try {
      const db = getDb();
      const settingsSnap = await getClientDoc(clientDoc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        apiKey = settingsSnap.data()?.facturapiApiKey;
        if (!apiKey) firestoreError = 'Documento encontrado pero campo "facturapiApiKey" está vacío.';
      } else {
        firestoreError = 'El documento "settings/general" no existe en Firestore.';
      }
    } catch (e: any) {
      console.error('Error fetching settings from Firestore:', e);
      firestoreError = `Error de Firestore: ${e.message}`;
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: `La clave API de Facturapi no está configurada. ${firestoreError}`,
        debug: { hasConfig: !!firebaseConfig.projectId, projectId: firebaseConfig.projectId }
      });
    }
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
    let firestoreError = '';
    try {
      const db = getDb();
      const settingsSnap = await getClientDoc(clientDoc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        apiKey = settingsSnap.data()?.facturapiApiKey;
        if (!apiKey) firestoreError = 'Documento encontrado pero campo "facturapiApiKey" está vacío.';
      } else {
        firestoreError = 'El documento "settings/general" no existe en Firestore.';
      }
    } catch (e: any) {
      console.error('Error fetching settings from Firestore:', e);
      firestoreError = `Error de Firestore: ${e.message}`;
    }

    if (!apiKey) {
      console.error('[PDF Proxy] Error: API Key no proporcionada');
      return res.status(400).send(`La clave API no está configurada. ${firestoreError}`);
    }
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
  const { studentName, amount, concept, email, phone, origin } = req.body;
  
  let privateKey = process.env.CONEKTA_PRIVATE_KEY;

  if (!privateKey) {
    let firestoreError = '';
    try {
      const db = getDb();
      const settingsSnap = await getClientDoc(clientDoc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        privateKey = settingsSnap.data()?.conektaPrivateKey;
        if (!privateKey) firestoreError = 'Documento encontrado pero campo "conektaPrivateKey" está vacío.';
      } else {
        firestoreError = 'El documento "settings/general" no existe en Firestore.';
      }
    } catch (e: any) {
      console.error('Error fetching settings from Firestore:', e);
      firestoreError = `Error de Firestore: ${e.message}`;
    }

    if (!privateKey) {
      return res.status(500).json({ 
        error: `La clave privada de Conekta no está configurada. ${firestoreError}`,
        debug: { hasConfig: !!firebaseConfig.projectId, projectId: firebaseConfig.projectId }
      });
    }
  }

  // Sanitize inputs for Conekta
  let sanitizedPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  if (!sanitizedPhone || sanitizedPhone.length < 10) {
    sanitizedPhone = '+525555555555';
  }

  let sanitizedName = studentName ? studentName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim() : '';
  if (!sanitizedName || sanitizedName.length < 2) {
    sanitizedName = 'Cliente Escolar';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let sanitizedEmail = email && emailRegex.test(email) ? email : 'cliente@ejemplo.com';

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
          name: sanitizedName,
          email: sanitizedEmail,
          phone: sanitizedPhone
        },
        line_items: [{
          name: concept,
          unit_price: Math.round(amount * 100), // Conekta uses cents
          quantity: 1
        }],
        checkout: {
          allowed_payment_methods: ['card', 'cash', 'bank_transfer'],
          type: 'HostedPayment',
          success_url: `${process.env.APP_URL || origin || 'http://localhost:3000'}/?payment=success`,
          failure_url: `${process.env.APP_URL || origin || 'http://localhost:3000'}/?payment=failure`,
          monthly_installments_enabled: false,
          redirection_time: 10
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
    let firestoreError = '';
    try {
      const db = getDb();
      const settingsSnap = await getClientDoc(clientDoc(db, 'settings', 'general'));
      if (settingsSnap.exists()) {
        privateKey = settingsSnap.data()?.conektaPrivateKey;
        if (!privateKey) firestoreError = 'Documento encontrado pero campo "conektaPrivateKey" está vacío.';
      } else {
        firestoreError = 'El documento "settings/general" no existe en Firestore.';
      }
    } catch (e: any) {
      console.error('Error fetching settings from Firestore:', e);
      firestoreError = `Error de Firestore: ${e.message}`;
    }

    if (!privateKey) {
      return res.status(500).json({ 
        error: `La clave privada de Conekta no está configurada. ${firestoreError}`,
        debug: { hasConfig: !!firebaseConfig.projectId, projectId: firebaseConfig.projectId }
      });
    }
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
