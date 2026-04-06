import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Facturapi Proxy Endpoint
app.post('/api/facturapi/invoice', async (req, res) => {
  const { apiKey, invoiceData } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'La clave API de Facturapi es requerida.' });
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
  const apiKey = req.query.apiKey as string;

  console.log(`Attempting to download PDF for invoice: ${id}`);

  if (!apiKey) {
    return res.status(400).send('La clave API es requerida.');
  }

  try {
    const response = await fetch(`https://www.facturapi.io/v2/invoices/${id}/pdf`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Facturapi PDF Error Response (${response.status}):`, text);
      return res.status(response.status).send(`Error al obtener PDF de Facturapi: ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`PDF fetched successfully, size: ${buffer.length} bytes`);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=factura-${id}.pdf`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });
    
    res.end(buffer);
  } catch (error: any) {
    console.error('Facturapi PDF Proxy Error:', error);
    res.status(500).send(`Error interno al procesar el PDF: ${error.message}`);
  }
});

// Catch-all for undefined API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.url}` });
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
