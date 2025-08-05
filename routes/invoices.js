// routes/invoices.js - Rutas para gestión de facturas
const express = require('express');
const Joi = require('joi');
const { query, transaction } = require('../config/database');

const router = express.Router();

// Validación de esquemas
const invoiceSchema = Joi.object({
  company_phone: Joi.string().required(),
  supplier_name: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('EUR'),
  invoice_date: Joi.date(),
  due_date: Joi.date(),
  tax_id: Joi.string().allow(''),
  description: Joi.string().allow(''),
  category: Joi.string().allow(''),
  status: Joi.string().valid('pending', 'confirmed', 'paid').default('pending')
});

const updateSchema = Joi.object({
  supplier_name: Joi.string(),
  amount: Joi.number().positive(),
  currency: Joi.string().length(3),
  invoice_date: Joi.date(),
  due_date: Joi.date(),
  tax_id: Joi.string().allow(''),
  description: Joi.string().allow(''),
  category: Joi.string(),
  status: Joi.string().valid('pending', 'confirmed', 'paid')
}).min(1);

// GET /api/invoices - Listar facturas con filtros
router.get('/', async (req, res) => {
  try {
    const {
      company_phone,
      status,
      category,
      supplier,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Construir query dinámicamente
    let baseQuery = `
      SELECT 
        i.*,
        s.name as supplier_full_name,
        s.rating as supplier_rating
      FROM invoices i
      LEFT JOIN suppliers s ON i.supplier_name = s.name 
        AND i.company_phone = s.company_phone
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    // Filtros opcionales
    if (company_phone) {
      baseQuery += ` AND i.company_phone = $${++paramCount}`;
      params.push(company_phone);
    }
    
    if (status) {
      baseQuery += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }
    
    if (category) {
      baseQuery += ` AND i.category ILIKE $${++paramCount}`;
      params.push(`%${category}%`);
    }
    
    if (supplier) {
      baseQuery += ` AND i.supplier_name ILIKE $${++paramCount}`;
      params.push(`%${supplier}%`);
    }
    
    if (date_from) {
      baseQuery += ` AND i.invoice_date >= $${++paramCount}`;
      params.push(date_from);
    }
    
    if (date_to) {
      baseQuery += ` AND i.invoice_date <= $${++paramCount}`;
      params.push(date_to);
    }

    // Ordenamiento y paginación
    const validSortColumns = ['created_at', 'invoice_date', 'amount', 'supplier_name'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    baseQuery += ` ORDER BY i.${sortColumn} ${sortDirection}`;
    baseQuery += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    // Ejecutar query principal
    const result = await query(baseQuery, params);

    // Query para contar total (para paginación)
    let countQuery = baseQuery.split('ORDER BY')[0].replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countParams = params.slice(0, -2); // Remover LIMIT y OFFSET
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
    console.error('Error obteniendo facturas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo facturas'
    });
  }
});

// GET /api/invoices/:id - Obtener factura específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        i.*,
        s.name as supplier_full_name,
        s.phone as supplier_phone,
        s.email as supplier_email,
        s.rating as supplier_rating,
        array_agg(
          json_build_object(
            'amount', p.amount,
            'payment_date', p.payment_date,
            'method', p.payment_method
          )
        ) FILTER (WHERE p.id IS NOT NULL) as payments
      FROM invoices i
      LEFT JOIN suppliers s ON i.supplier_name = s.name 
        AND i.company_phone = s.company_phone
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.id = $1
      GROUP BY i.id, s.name, s.phone, s.email, s.rating
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error obteniendo factura:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo factura'
    });
  }
});

// POST /api/invoices - Crear nueva factura
router.post('/', async (req, res) => {
  try {
    // Validar datos de entrada
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(d => d.message)
      });
    }

    const result = await transaction(async (client) => {
      // Insertar factura
      const invoiceResult = await client.query(`
        INSERT INTO invoices (
          company_phone, supplier_name, amount, currency,
          invoice_date, due_date, tax_id, description,
          category, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `, [
        value.company_phone,
        value.supplier_name,
        value.amount,
        value.currency,
        value.invoice_date,
        value.due_date,
        value.tax_id,
        value.description,
        value.category,
        value.status
      ]);

      // Actualizar o crear proveedor
      await client.query(`
        INSERT INTO suppliers (
          name, company_phone, total_invoices, 
          total_amount, last_invoice_date, created_at
        ) VALUES ($1, $2, 1, $3, $4, NOW())
        ON CONFLICT (name, company_phone) 
        DO UPDATE SET
          total_invoices = suppliers.total_invoices + 1,
          total_amount = suppliers.total_amount + $3,
          last_invoice_date = $4,
          updated_at = NOW()
      `, [
        value.supplier_name,
        value.company_phone,
        value.amount,
        value.invoice_date || new Date()
      ]);

      return invoiceResult.rows[0];
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Factura creada exitosamente'
    });

  } catch (error) {
    console.error('Error creando factura:', error);
    res.status(500).json({
      success: false,
      error: 'Error creando factura'
    });
  }
});

// PUT /api/invoices/:id - Actualizar factura
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar datos de entrada
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(d => d.message)
      });
    }

    // Construir query de actualización dinámicamente
    const updates = [];
    const params = [];
    let paramCount = 0;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updates.push(`${key} = $${++paramCount}`);
        params.push(val);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(`
      UPDATE invoices 
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Factura actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando factura:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando factura'
    });
  }
});

// DELETE /api/invoices/:id - Eliminar factura
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM invoices 
      WHERE id = $1 
      RETURNING id, supplier_name, amount
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Factura eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando factura:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando factura'
    });
  }
});

// PATCH /api/invoices/:id/status - Cambiar estado de factura
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'paid'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido. Debe ser: pending, confirmed, o paid'
      });
    }

    const result = await query(`
      UPDATE invoices 
      SET status = $1, 
          confirmed_at = CASE WHEN $1 = 'confirmed' THEN NOW() ELSE confirmed_at END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Estado cambiado a ${status}`
    });

  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({
      success: false,
      error: 'Error cambiando estado'
    });
  }
});

module.exports = router;