// routes/suppliers.js - Rutas para gestión de proveedores
const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');

const router = express.Router();

// Validación de esquemas
const supplierSchema = Joi.object({
  name: Joi.string().required(),
  tax_id: Joi.string().allow(''),
  phone: Joi.string().allow(''),
  email: Joi.string().email().allow(''),
  address: Joi.string().allow(''),
  website: Joi.string().uri().allow(''),
  payment_terms: Joi.number().integer().min(0).default(30),
  company_phone: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5)
});

// GET /api/suppliers - Listar proveedores
router.get('/', async (req, res) => {
  try {
    const {
      company_phone,
      sort_by = 'total_amount',
      sort_order = 'DESC',
      limit = 50,
      offset = 0,
      search
    } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    let baseQuery = `
      SELECT 
        s.*,
        COALESCE(i.invoice_count, 0) as invoice_count,
        COALESCE(i.total_spent, 0) as total_spent,
        COALESCE(i.avg_amount, 0) as avg_amount,
        COALESCE(i.last_invoice_date, s.last_invoice_date) as last_invoice_date,
        CASE 
          WHEN i.last_invoice_date < NOW() - INTERVAL '90 days' THEN 'inactive'
          WHEN i.last_invoice_date < NOW() - INTERVAL '30 days' THEN 'low_activity'
          ELSE 'active'
        END as activity_status
      FROM suppliers s
      LEFT JOIN (
        SELECT 
          supplier_name,
          company_phone,
          COUNT(*) as invoice_count,
          SUM(amount) as total_spent,
          ROUND(AVG(amount)::numeric, 2) as avg_amount,
          MAX(invoice_date) as last_invoice_date
        FROM invoices 
        WHERE company_phone = $1
        GROUP BY supplier_name, company_phone
      ) i ON s.name = i.supplier_name AND s.company_phone = i.company_phone
      WHERE s.company_phone = $1
    `;

    const params = [company_phone];
    let paramCount = 1;

    // Filtro de búsqueda
    if (search) {
      baseQuery += ` AND (s.name ILIKE $${++paramCount} OR s.tax_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Ordenamiento
    const validSortColumns = ['name', 'total_amount', 'invoice_count', 'last_invoice_date', 'rating'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'total_amount';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (sortColumn === 'total_amount') {
      baseQuery += ` ORDER BY COALESCE(i.total_spent, 0) ${sortDirection}`;
    } else if (sortColumn === 'invoice_count') {
      baseQuery += ` ORDER BY COALESCE(i.invoice_count, 0) ${sortDirection}`;
    } else {
      baseQuery += ` ORDER BY s.${sortColumn} ${sortDirection}`;
    }

    baseQuery += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(baseQuery, params);

    // Count para paginación
    let countQuery = `
      SELECT COUNT(*) 
      FROM suppliers s 
      WHERE s.company_phone = $1
    `;
    const countParams = [company_phone];
    
    if (search) {
      countQuery += ` AND (s.name ILIKE $2 OR s.tax_id ILIKE $2)`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proveedores'
    });
  }
});

// GET /api/suppliers/:id - Obtener proveedor específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        s.*,
        json_agg(
          json_build_object(
            'id', i.id,
            'amount', i.amount,
            'invoice_date', i.invoice_date,
            'due_date', i.due_date,
            'status', i.status,
            'description', i.description
          ) ORDER BY i.invoice_date DESC
        ) FILTER (WHERE i.id IS NOT NULL) as recent_invoices
      FROM suppliers s
      LEFT JOIN invoices i ON s.name = i.supplier_name 
        AND s.company_phone = i.company_phone
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo proveedor'
    });
  }
});

// GET /api/suppliers/analytics/top - Top proveedores con métricas
router.get('/analytics/top', async (req, res) => {
  try {
    const { company_phone, period = '12m', limit = 10 } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Determinar filtro de período
    let dateFilter = '';
    switch (period) {
      case '1m':
        dateFilter = "AND i.invoice_date >= NOW() - INTERVAL '1 month'";
        break;
      case '3m':
        dateFilter = "AND i.invoice_date >= NOW() - INTERVAL '3 months'";
        break;
      case '6m':
        dateFilter = "AND i.invoice_date >= NOW() - INTERVAL '6 months'";
        break;
      case '12m':
        dateFilter = "AND i.invoice_date >= NOW() - INTERVAL '12 months'";
        break;
      default:
        dateFilter = "AND i.invoice_date >= NOW() - INTERVAL '12 months'";
    }

    const result = await query(`
      SELECT 
        i.supplier_name,
        COUNT(*) as invoice_count,
        SUM(i.amount) as total_amount,
        ROUND(AVG(i.amount)::numeric, 2) as avg_amount,
        MIN(i.amount) as min_amount,
        MAX(i.amount) as max_amount,
        MAX(i.invoice_date) as last_invoice_date,
        MIN(i.invoice_date) as first_invoice_date,
        s.rating,
        s.payment_terms,
        s.phone as supplier_phone,
        s.email as supplier_email,
        
        -- Análisis de frecuencia
        ROUND(
          COUNT(*) * 30.0 / 
          GREATEST(1, EXTRACT(DAYS FROM (MAX(i.invoice_date) - MIN(i.invoice_date))))
        , 2) as avg_invoices_per_month,
        
        -- Análisis de tendencia (últimos 3 meses vs anteriores)
        SUM(CASE WHEN i.invoice_date >= NOW() - INTERVAL '3 months' THEN i.amount ELSE 0 END) as recent_3m_amount,
        SUM(CASE WHEN i.invoice_date < NOW() - INTERVAL '3 months' THEN i.amount ELSE 0 END) as older_amount,
        
        -- Score de importancia (combinando volumen, frecuencia y recencia)
        (
          (SUM(i.amount) / 1000.0) * 0.4 +  -- Volumen (normalizado)
          COUNT(*) * 0.3 +                   -- Frecuencia
          (30 - LEAST(30, EXTRACT(DAYS FROM (NOW() - MAX(i.invoice_date))))) * 0.3  -- Recencia
        ) as importance_score
        
      FROM invoices i
      LEFT JOIN suppliers s ON i.supplier_name = s.name 
        AND i.company_phone = s.company_phone
      WHERE i.company_phone = $1 ${dateFilter}
      GROUP BY i.supplier_name, s.rating, s.payment_terms, s.phone, s.email
      ORDER BY importance_score DESC
      LIMIT $2
    `, [company_phone, parseInt(limit)]);

    res.json({
      success: true,
      data: {
        period,
        suppliers: result.rows,
        summary: {
          total_suppliers: result.rows.length,
          total_analyzed_amount: result.rows.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
          avg_supplier_value: result.rows.length > 0 
            ? Math.round(result.rows.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0) / result.rows.length)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo top proveedores:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo analytics de proveedores'
    });
  }
});

// POST /api/suppliers - Crear/actualizar proveedor
router.post('/', async (req, res) => {
  try {
    const { error, value } = supplierSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(d => d.message)
      });
    }

    const result = await query(`
      INSERT INTO suppliers (
        name, tax_id, phone, email, address, website,
        payment_terms, company_phone, rating, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (name, company_phone) 
      DO UPDATE SET
        tax_id = EXCLUDED.tax_id,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        website = EXCLUDED.website,
        payment_terms = EXCLUDED.payment_terms,
        rating = EXCLUDED.rating,
        updated_at = NOW()
      RETURNING *
    `, [
      value.name,
      value.tax_id,
      value.phone,
      value.email,
      value.address,
      value.website,
      value.payment_terms,
      value.company_phone,
      value.rating
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Proveedor guardado exitosamente'
    });

  } catch (error) {
    console.error('Error guardando proveedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error guardando proveedor'
    });
  }
});

module.exports = router;