import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Facturapi Proxy Endpoint
  app.post('/api/facturapi/invoice', async (req, res) => {
    const { apiKey, invoiceData } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Facturapi API Key is required' });
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error creating invoice');
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

    if (!apiKey) {
      return res.status(400).send('API Key is required');
    }

    try {
      const response = await fetch(`https://www.facturapi.io/v2/invoices/${id}/pdf`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
        }
      });

      if (!response.ok) throw new Error('Error fetching PDF');

      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=factura-${id}.pdf`);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
