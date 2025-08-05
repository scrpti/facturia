// server.js - API Gateway Principal
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar rutas
const invoicesRoutes = require('./routes/invoices');
const analyticsRoutes = require('./routes/analytics');
const suppliersRoutes = require('./routes/suppliers');
const ocrRoutes = require('./routes/ocr');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: {
    error: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.'
  }
});
app.use('/api/', limiter);

// CORS configurado para desarrollo
app.use(cors({
  origin: [
    'http://localhost:3000', // React dev
    'http://localhost:5173', // Vite dev
    'https://tu-dashboard.vercel.app' // Producción
  ],
  credentials: true
}));

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Health check básico
app.get('/', (req, res) => {
  res.json({
    message: 'Invoice Management API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Rutas principales
app.use('/api/health', healthRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/ocr', ocrRoutes);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler global
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  
  res.status(error.status || 500).json({
    error: error.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 API disponible en: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;