// routes/ocr.js - Rutas para procesamiento OCR
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');

const router = express.Router();

// Configuración de multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB por defecto
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
  }
});

// Función para procesar imagen con OCR (simulado por ahora)
async function processImageOCR(imageBuffer, phone) {
  try {
    // Por ahora simulamos el OCR, más adelante integraremos Tesseract o Google Vision
    
    // Optimizar imagen
    const optimizedImage = await sharp(imageBuffer)
      .resize(1200, null, { withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Simular procesamiento OCR con datos realistas
    const simulatedResult = {
      success: true,
      confidence: 0.95,
      phone: phone,
      processing_time_ms: Math.floor(Math.random() * 2000) + 1000,
      data: {
        supplier_name: 'Iberdrola Distribución Eléctrica',
        supplier_tax_id: 'A95075431',
        supplier_address: 'Plaza Euskadi, 5, 48009 Bilbao',
        amount: parseFloat((Math.random() * 500 + 50).toFixed(2)),
        currency: 'EUR',
        invoice_number: `FAC-${Date.now().toString().slice(-6)}`,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tax_amount: null,
        tax_rate: 21.0,
        description: 'Suministro eléctrico - Consumo energía',
        category: 'Suministros'
      },
      raw_text: 'IBERDROLA DISTRIBUCIÓN ELÉCTRICA S.A.U.\nA95075431\nPlaza Euskadi, 5\n48009 Bilbao\n...',
      extracted_fields: [
        { field: 'supplier_name', value: 'Iberdrola Distribución Eléctrica', confidence: 0.98 },
        { field: 'amount', value: '125.50', confidence: 0.95 },
        { field: 'invoice_date', value: '2025-08-04', confidence: 0.92 }
      ]
    };

    // Calcular tax_amount si no está presente
    if (!simulatedResult.data.tax_amount && simulatedResult.data.tax_rate) {
      const baseAmount = simulatedResult.data.amount / (1 + simulatedResult.data.tax_rate / 100);
      simulatedResult.data.tax_amount = parseFloat((simulatedResult.data.amount - baseAmount).toFixed(2));
    }

    return simulatedResult;

  } catch (error) {
    console.error('Error procesando OCR:', error);
    return {
      success: false,
      error: 'Error procesando imagen',
      details: error.message,
      phone: phone
    };
  }
}

// Función para integración real con Google Vision (descomentada cuando tengas API key)
async function processWithGoogleVision(imageBuffer) {
  try {
    // Requiere configurar GOOGLE_APPLICATION_CREDENTIALS
    // const vision = require('@google-cloud/vision');
    // const client = new vision.ImageAnnotatorClient();
    
    // const [result] = await client.textDetection({
    //   image: { content: imageBuffer.toString('base64') }
    // });
    
    // const detections = result.textAnnotations;
    // const fullText = detections[0]?.description || '';
    
    // // Aquí procesarías el texto extraído para encontrar campos específicos
    // return parseInvoiceText(fullText);
    
    throw new Error('Google Vision no configurado');
  } catch (error) {
    throw new Error(`Google Vision error: ${error.message}`);
  }
}

// POST /api/ocr/process - Procesar imagen de factura
router.post('/process', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó imagen'
      });
    }

    const { phone, source = 'api' } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono es requerido'
      });
    }

    console.log(`📸 Procesando imagen OCR para ${phone}, tamaño: ${req.file.size} bytes`);

    // Procesar imagen con OCR
    const startTime = Date.now();
    const ocrResult = await processImageOCR(req.file.buffer, phone);
    const processingTime = Date.now() - startTime;

    // Añadir metadatos del procesamiento
    ocrResult.metadata = {
      original_filename: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      processing_time_ms: processingTime,
      source: source,
      processed_at: new Date().toISOString()
    };

    if (ocrResult.success) {
      console.log(`✅ OCR exitoso para ${phone}: ${ocrResult.data.supplier_name} - ${ocrResult.data.amount}€`);
    } else {
      console.log(`❌ OCR falló para ${phone}: ${ocrResult.error}`);
    }

    res.json(ocrResult);

  } catch (error) {
    console.error('Error en endpoint OCR:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno procesando imagen',
      details: error.message
    });
  }
});

// POST /api/ocr/process-url - Procesar imagen desde URL (para n8n/Twilio)
router.post('/process-url', async (req, res) => {
  try {
    const { image_url, phone, source = 'webhook' } = req.body;

    if (!image_url || !phone) {
      return res.status(400).json({
        success: false,
        error: 'image_url y phone son requeridos'
      });
    }

    console.log(`📸 Procesando imagen desde URL para ${phone}: ${image_url}`);

    // Descargar imagen desde URL
    const response = await axios.get(image_url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Invoice-Management-OCR/1.0'
      }
    });

    const imageBuffer = Buffer.from(response.data);
    
    // Verificar que es una imagen válida
    const imageInfo = await sharp(imageBuffer).metadata();
    console.log(`📊 Imagen descargada: ${imageInfo.width}x${imageInfo.height}, formato: ${imageInfo.format}`);

    // Procesar con OCR
    const startTime = Date.now();
    const ocrResult = await processImageOCR(imageBuffer, phone);
    const processingTime = Date.now() - startTime;

    // Añadir metadatos
    ocrResult.metadata = {
      source_url: image_url,
      image_width: imageInfo.width,
      image_height: imageInfo.height,
      image_format: imageInfo.format,
      file_size: imageBuffer.length,
      processing_time_ms: processingTime,
      source: source,
      processed_at: new Date().toISOString()
    };

    if (ocrResult.success) {
      console.log(`✅ OCR desde URL exitoso: ${ocrResult.data.supplier_name} - ${ocrResult.data.amount}€`);
    }

    res.json(ocrResult);

  } catch (error) {
    console.error('Error procesando imagen desde URL:', error);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        error: 'Timeout descargando imagen',
        details: 'La descarga de la imagen tardó demasiado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error procesando imagen desde URL',
      details: error.message
    });
  }
});

// GET /api/ocr/test - Endpoint de prueba para OCR
router.get('/test', async (req, res) => {
  try {
    // Generar datos de prueba
    const testResult = await processImageOCR(Buffer.alloc(100), '+34666777888');
    
    res.json({
      success: true,
      message: 'OCR service funcionando correctamente',
      test_result: testResult,
      capabilities: {
        supported_formats: ['image/jpeg', 'image/png', 'image/jpg'],
        max_file_size: '10MB',
        features: [
          'Extracción de datos de proveedor',
          'Detección de importes y fechas',
          'Categorización automática',
          'Validación de campos',
          'Procesamiento desde URL'
        ]
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error en test de OCR',
      details: error.message
    });
  }
});

// GET /api/ocr/status - Estado del servicio OCR
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    uptime: process.uptime(),
    features: {
      google_vision: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      tesseract: false, // Añadir cuando integres Tesseract
      image_optimization: true,
      url_processing: true
    },
    limits: {
      max_file_size: process.env.MAX_FILE_SIZE || '10MB',
      allowed_types: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg').split(','),
      timeout: '10s'
    }
  });
});

module.exports = router;