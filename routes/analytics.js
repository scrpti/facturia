// routes/analytics.js - Rutas para analytics y métricas
const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/analytics/dashboard - Métricas principales del dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { company_phone, period = '30d' } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Determinar rango de fechas según el período
    let dateFilter = '';
    switch (period) {
      case '7d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'";
        break;
      case '1y':
        dateFilter = "AND created_at >= NOW() - INTERVAL '1 year'";
        break;
      default:
        dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
    }

    // Métricas principales
    const metricsResult = await query(`
      WITH period_stats AS (
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(AVG(amount), 0) as avg_amount,
          COUNT(DISTINCT supplier_name) as unique_suppliers,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_invoices,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'paid') as overdue_invoices
        FROM invoices 
        WHERE company_phone = $1 ${dateFilter}
      ),
      previous_period_stats AS (
        SELECT 
          COUNT(*) as prev_total_invoices,
          COALESCE(SUM(amount), 0) as prev_total_amount
        FROM invoices 
        WHERE company_phone = $1 
          AND created_at < (NOW() - INTERVAL '${period.replace('d', ' days').replace('y', ' year')}')
          AND created_at >= (NOW() - INTERVAL '${period.replace('d', ' days').replace('y', ' year')}' * 2)
      )
      SELECT 
        ps.*,
        pps.prev_total_invoices,
        pps.prev_total_amount,
        CASE 
          WHEN pps.prev_total_amount > 0 THEN 
            ROUND(((ps.total_amount - pps.prev_total_amount) / pps.prev_total_amount * 100)::numeric, 2)
          ELSE 0 
        END as amount_change_percent,
        CASE 
          WHEN pps.prev_total_invoices > 0 THEN 
            ROUND(((ps.total_invoices - pps.prev_total_invoices) / pps.prev_total_invoices::numeric * 100), 2)
          ELSE 0 
        END as invoices_change_percent
      FROM period_stats ps
      CROSS JOIN previous_period_stats pps
    `, [company_phone]);

    // Top categorías
    const categoriesResult = await query(`
      SELECT 
        category,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        ROUND(AVG(amount)::numeric, 2) as avg_amount
      FROM invoices 
      WHERE company_phone = $1 ${dateFilter}
        AND category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 10
    `, [company_phone]);

    // Top proveedores
    const suppliersResult = await query(`
      SELECT 
        supplier_name,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        ROUND(AVG(amount)::numeric, 2) as avg_amount,
        MAX(created_at) as last_invoice_date
      FROM invoices 
      WHERE company_phone = $1 ${dateFilter}
      GROUP BY supplier_name
      ORDER BY total_amount DESC
      LIMIT 10
    `, [company_phone]);

    // Tendencia mensual (últimos 6 meses)
    const trendResult = await query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        ROUND(AVG(amount)::numeric, 2) as avg_amount
      FROM invoices 
      WHERE company_phone = $1 
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `, [company_phone]);

    res.json({
      success: true,
      data: {
        period,
        metrics: metricsResult.rows[0] || {},
        top_categories: categoriesResult.rows,
        top_suppliers: suppliersResult.rows,
        monthly_trend: trendResult.rows,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo analytics del dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo analytics del dashboard'
    });
  }
});

// GET /api/analytics/monthly - Resumen mensual detallado
router.get('/monthly', async (req, res) => {
  try {
    const { company_phone, year, month } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Usar año y mes actual si no se especifican
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    const result = await query(`
      WITH monthly_stats AS (
        SELECT 
          COUNT(*) as total_invoices,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          COUNT(DISTINCT supplier_name) as unique_suppliers,
          COUNT(DISTINCT category) as unique_categories
        FROM invoices 
        WHERE company_phone = $1 
          AND EXTRACT(YEAR FROM invoice_date) = $2
          AND EXTRACT(MONTH FROM invoice_date) = $3
      ),
      daily_breakdown AS (
        SELECT 
          EXTRACT(DAY FROM invoice_date) as day,
          COUNT(*) as daily_invoices,
          SUM(amount) as daily_amount
        FROM invoices 
        WHERE company_phone = $1 
          AND EXTRACT(YEAR FROM invoice_date) = $2
          AND EXTRACT(MONTH FROM invoice_date) = $3
        GROUP BY EXTRACT(DAY FROM invoice_date)
        ORDER BY day
      ),
      category_breakdown AS (
        SELECT 
          category,
          COUNT(*) as count,
          SUM(amount) as amount,
          ROUND((SUM(amount) / SUM(SUM(amount)) OVER ()) * 100, 2) as percentage
        FROM invoices 
        WHERE company_phone = $1 
          AND EXTRACT(YEAR FROM invoice_date) = $2
          AND EXTRACT(MONTH FROM invoice_date) = $3
          AND category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY amount DESC
      )
      SELECT 
        json_build_object(
          'total_invoices', ms.total_invoices,
          'total_amount', ms.total_amount,
          'avg_amount', ROUND(ms.avg_amount::numeric, 2),
          'min_amount', ms.min_amount,
          'max_amount', ms.max_amount,
          'unique_suppliers', ms.unique_suppliers,
          'unique_categories', ms.unique_categories
        ) as summary,
        
        COALESCE(
          json_agg(
            json_build_object(
              'day', db.day,
              'invoices', db.daily_invoices,
              'amount', db.daily_amount
            ) ORDER BY db.day
          ) FILTER (WHERE db.day IS NOT NULL), 
          '[]'::json
        ) as daily_breakdown,
        
        COALESCE(
          json_agg(
            json_build_object(
              'category', cb.category,
              'count', cb.count,
              'amount', cb.amount,
              'percentage', cb.percentage
            ) ORDER BY cb.amount DESC
          ) FILTER (WHERE cb.category IS NOT NULL), 
          '[]'::json
        ) as category_breakdown
        
      FROM monthly_stats ms
      LEFT JOIN daily_breakdown db ON true
      LEFT JOIN category_breakdown cb ON true
      GROUP BY ms.total_invoices, ms.total_amount, ms.avg_amount, 
               ms.min_amount, ms.max_amount, ms.unique_suppliers, ms.unique_categories
    `, [company_phone, targetYear, targetMonth]);

    res.json({
      success: true,
      data: {
        year: parseInt(targetYear),
        month: parseInt(targetMonth),
        ...(result.rows[0] || {
          summary: {},
          daily_breakdown: [],
          category_breakdown: []
        })
      }
    });

  } catch (error) {
    console.error('Error obteniendo resumen mensual:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo resumen mensual'
    });
  }
});

// GET /api/analytics/trends - Análisis de tendencias
router.get('/trends', async (req, res) => {
  try {
    const { company_phone, period = '12m' } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Tendencias por mes
    const monthlyTrends = await query(`
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        ROUND(AVG(amount)::numeric, 2) as avg_amount,
        COUNT(DISTINCT supplier_name) as unique_suppliers
      FROM invoices 
      WHERE company_phone = $1 
        AND invoice_date >= NOW() - INTERVAL '${period === '12m' ? '12 months' : '6 months'}'
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month
    `, [company_phone]);

    // Tendencias por día de la semana
    const weeklyTrends = await query(`
      SELECT 
        EXTRACT(DOW FROM invoice_date) as day_of_week,
        TO_CHAR(DATE_TRUNC('week', invoice_date), 'Day') as day_name,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        ROUND(AVG(amount)::numeric, 2) as avg_amount
      FROM invoices 
      WHERE company_phone = $1 
        AND invoice_date >= NOW() - INTERVAL '3 months'
      GROUP BY EXTRACT(DOW FROM invoice_date), TO_CHAR(DATE_TRUNC('week', invoice_date), 'Day')
      ORDER BY day_of_week
    `, [company_phone]);

    // Análisis de crecimiento
    const growthAnalysis = await query(`
      WITH monthly_data AS (
        SELECT 
          DATE_TRUNC('month', invoice_date) as month,
          SUM(amount) as monthly_amount
        FROM invoices 
        WHERE company_phone = $1 
          AND invoice_date >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', invoice_date)
        ORDER BY month
      )
      SELECT 
        month,
        monthly_amount,
        LAG(monthly_amount) OVER (ORDER BY month) as previous_month,
        CASE 
          WHEN LAG(monthly_amount) OVER (ORDER BY month) > 0 THEN
            ROUND(((monthly_amount - LAG(monthly_amount) OVER (ORDER BY month)) / 
                   LAG(monthly_amount) OVER (ORDER BY month) * 100)::numeric, 2)
          ELSE 0
        END as growth_rate
      FROM monthly_data
      ORDER BY month DESC
      LIMIT 6
    `, [company_phone]);

    res.json({
      success: true,
      data: {
        period,
        monthly_trends: monthlyTrends.rows,
        weekly_patterns: weeklyTrends.rows,
        growth_analysis: growthAnalysis.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo tendencias'
    });
  }
});

// GET /api/analytics/predictions - Predicciones y forecasting
router.get('/predictions', async (req, res) => {
  try {
    const { company_phone } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Análisis de patrones históricos para predicciones simples
    const historicalData = await query(`
      WITH monthly_avg AS (
        SELECT 
          EXTRACT(MONTH FROM invoice_date) as month,
          ROUND(AVG(amount)::numeric, 2) as avg_monthly_amount,
          COUNT(*) as avg_monthly_invoices
        FROM invoices 
        WHERE company_phone = $1 
          AND invoice_date >= NOW() - INTERVAL '12 months'
        GROUP BY EXTRACT(MONTH FROM invoice_date)
      ),
      recent_trend AS (
        SELECT 
          AVG(amount) as recent_avg,
          COUNT(*) as recent_count
        FROM invoices 
        WHERE company_phone = $1 
          AND invoice_date >= NOW() - INTERVAL '3 months'
      ),
      growth_rate AS (
        SELECT 
          CASE 
            WHEN COUNT(*) >= 2 THEN
              (MAX(monthly_total) - MIN(monthly_total)) / MIN(monthly_total) * 100
            ELSE 0
          END as monthly_growth_rate
        FROM (
          SELECT 
            DATE_TRUNC('month', invoice_date) as month,
            SUM(amount) as monthly_total
          FROM invoices 
          WHERE company_phone = $1 
            AND invoice_date >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', invoice_date)
          ORDER BY month DESC
          LIMIT 2
        ) sub
      )
      SELECT 
        json_build_object(
          'next_month_predicted_amount', 
          ROUND((rt.recent_avg * rt.recent_count * (1 + gr.monthly_growth_rate/100))::numeric, 2),
          'next_month_predicted_invoices', 
          CEIL(rt.recent_count * 1.1),
          'confidence_level', 
          CASE 
            WHEN rt.recent_count >= 10 THEN 'High'
            WHEN rt.recent_count >= 5 THEN 'Medium'
            ELSE 'Low'
          END,
          'based_on_months', 3
        ) as predictions,
        
        json_agg(
          json_build_object(
            'month', ma.month,
            'historical_avg_amount', ma.avg_monthly_amount,
            'historical_avg_invoices', ma.avg_monthly_invoices
          )
        ) as seasonal_patterns
        
      FROM recent_trend rt
      CROSS JOIN growth_rate gr
      CROSS JOIN monthly_avg ma
      GROUP BY rt.recent_avg, rt.recent_count, gr.monthly_growth_rate
    `, [company_phone]);

    // Análisis de proveedores recurrentes
    const supplierPatterns = await query(`
      SELECT 
        supplier_name,
        COUNT(*) as frequency,
        ROUND(AVG(amount)::numeric, 2) as avg_amount,
        MAX(invoice_date) as last_invoice,
        CASE 
          WHEN MAX(invoice_date) < NOW() - INTERVAL '60 days' THEN 'overdue'
          WHEN MAX(invoice_date) < NOW() - INTERVAL '30 days' THEN 'expected_soon'
          ELSE 'recent'
        END as status
      FROM invoices 
      WHERE company_phone = $1 
        AND invoice_date >= NOW() - INTERVAL '12 months'
      GROUP BY supplier_name
      HAVING COUNT(*) >= 3
      ORDER BY frequency DESC, last_invoice DESC
      LIMIT 10
    `, [company_phone]);

    res.json({
      success: true,
      data: {
        predictions: historicalData.rows[0]?.predictions || {},
        seasonal_patterns: historicalData.rows[0]?.seasonal_patterns || [],
        supplier_patterns: supplierPatterns.rows,
        disclaimer: 'Las predicciones están basadas en patrones históricos y deben usarse como referencia.'
      }
    });

  } catch (error) {
    console.error('Error obteniendo predicciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo predicciones'
    });
  }
});

// GET /api/analytics/cashflow - Análisis de cash flow
router.get('/cashflow', async (req, res) => {
  try {
    const { company_phone, months = 6 } = req.query;

    if (!company_phone) {
      return res.status(400).json({
        success: false,
        error: 'company_phone es requerido'
      });
    }

    // Análisis de cash flow por fechas de vencimiento
    const cashflowData = await query(`
      WITH monthly_cashflow AS (
        SELECT 
          DATE_TRUNC('month', due_date) as month,
          SUM(amount) FILTER (WHERE status = 'confirmed') as pending_payments,
          SUM(amount) FILTER (WHERE status = 'paid') as completed_payments,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'paid') as overdue_count,
          SUM(amount) FILTER (WHERE due_date < CURRENT_DATE AND status != 'paid') as overdue_amount
        FROM invoices 
        WHERE company_phone = $1 
          AND due_date >= NOW() - INTERVAL '${parseInt(months)} months'
          AND due_date <= NOW() + INTERVAL '3 months'
        GROUP BY DATE_TRUNC('month', due_date)
        ORDER BY month
      ),
      upcoming_payments AS (
        SELECT 
          due_date,
          supplier_name,
          amount,
          status,
          CASE 
            WHEN due_date < CURRENT_DATE THEN 'overdue'
            WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_this_week'
            WHEN due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_this_month'
            ELSE 'future'
          END as urgency
        FROM invoices 
        WHERE company_phone = $1 
          AND status IN ('confirmed', 'pending')
          AND due_date IS NOT NULL
          AND due_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY due_date ASC
        LIMIT 20
      )
      SELECT 
        (SELECT json_agg(
          json_build_object(
            'month', cf.month,
            'pending_payments', COALESCE(cf.pending_payments, 0),
            'completed_payments', COALESCE(cf.completed_payments, 0),
            'overdue_count', COALESCE(cf.overdue_count, 0),
            'overdue_amount', COALESCE(cf.overdue_amount, 0)
          ) ORDER BY cf.month
        ) FROM monthly_cashflow cf) as monthly_cashflow,
        
        (SELECT json_agg(
          json_build_object(
            'due_date', up.due_date,
            'supplier_name', up.supplier_name,
            'amount', up.amount,
            'status', up.status,
            'urgency', up.urgency
          ) ORDER BY up.due_date
        ) FROM upcoming_payments up) as upcoming_payments
    `);

    res.json({
      success: true,
      data: {
        months: parseInt(months),
        ...(cashflowData.rows[0] || {
          monthly_cashflow: [],
          upcoming_payments: []
        })
      }
    });

  } catch (error) {
    console.error('Error obteniendo análisis de cashflow:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo análisis de cashflow'
    });
  }
});

// POST /api/analytics/update-metrics - Actualizar métricas (llamado desde n8n)
router.post('/update-metrics', async (req, res) => {
  try {
    const { phone, action, invoice_id } = req.body;

    if (!phone || !action) {
      return res.status(400).json({
        success: false,
        error: 'phone y action son requeridos'
      });
    }

    // Actualizar métricas diarias
    await query(`
      INSERT INTO analytics_daily (
        company_phone, 
        date, 
        total_invoices, 
        total_amount,
        pending_invoices,
        new_suppliers,
        created_at
      )
      SELECT 
        $1 as company_phone,
        CURRENT_DATE as date,
        COUNT(*) as total_invoices,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
        COUNT(DISTINCT supplier_name) as new_suppliers,
        NOW() as created_at
      FROM invoices 
      WHERE company_phone = $1 
        AND DATE(created_at) = CURRENT_DATE
      ON CONFLICT (company_phone, date) 
      DO UPDATE SET
        total_invoices = EXCLUDED.total_invoices,
        total_amount = EXCLUDED.total_amount,
        pending_invoices = EXCLUDED.pending_invoices,
        new_suppliers = EXCLUDED.new_suppliers
    `, [phone]);

    res.json({
      success: true,
      message: 'Métricas actualizadas correctamente',
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error actualizando métricas:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando métricas'
    });
  }
});

// POST /api/analytics/send-update - Webhook para n8n dashboard updates
router.post('/send-update', async (req, res) => {
  try {
    const { phone, invoice_id, action } = req.body;

    // Log del evento para debugging
    console.log(`📊 Analytics update: ${action} for ${phone}, invoice: ${invoice_id}`);

    // Aquí podrías añadir lógica para:
    // - Enviar updates por WebSocket al dashboard
    // - Trigger notificaciones push
    // - Actualizar cache de métricas

    res.json({
      success: true,
      message: 'Update procesado correctamente',
      data: { phone, invoice_id, action }
    });

  } catch (error) {
    console.error('Error procesando update:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando update'
    });
  }
});

module.exports = router;