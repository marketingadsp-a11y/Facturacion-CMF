import express from 'express';
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

  console.log(`[PDF Proxy] Iniciando descarga para factura: ${id}`);

  if (!apiKey) {
    console.error('[PDF Proxy] Error: API Key no proporcionada');
    return res.status(400).send('La clave API es requerida.');
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
