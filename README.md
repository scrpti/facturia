# 🧾 Sistema de Gestión Inteligente de Facturas para PYMEs

## 📋 Descripción del Proyecto

Sistema completo de gestión automatizada de facturas que permite a las PYMEs enviar facturas por WhatsApp a un bot inteligente que las procesa, analiza y proporciona insights valiosos para la gestión financiera.

## 🎯 Objetivos

- **Automatizar** el procesamiento de facturas mediante OCR e IA
- **Eliminar** errores manuales en la digitación de datos
- **Proporcionar** análisis financiero en tiempo real
- **Optimizar** el cash flow y cumplimiento fiscal
- **Integrar** múltiples fuentes de datos financieros

---

## 🔍 Pain Points Identificados

### 📝 Procesamiento Manual
- ⏱️ Tiempo excesivo digitando datos de facturas
- ❌ Errores humanos en la transcripción
- 📚 Acumulación de facturas sin procesar

### 👁️ Falta de Visibilidad
- 📊 Desconocimiento de gastos por categoría/proveedor
- 📅 Dificultad para seguimiento de pagos pendientes
- 📈 Ausencia de análisis de tendencias

### ⚖️ Cumplimiento Fiscal
- 🧾 Riesgo de perder facturas para deducciones
- 📋 Dificultad para generar reportes
- ⏰ Problemas con fechas límite

### 💰 Cash Flow
- ⚠️ Falta de anticipación de compromisos de pago
- 🔔 Ausencia de alertas por vencimientos
- 🤝 Dificultad para negociar términos con proveedores

---

## 🚀 Funcionalidades Principales

### 🤖 Bot de WhatsApp Inteligente
- **OCR Avanzado**: Extracción automática de datos de facturas fotografiadas
- **NLP**: Procesamiento de lenguaje natural para comandos conversacionales
- **Validación**: Verificación automática contra bases de datos fiscales
- **Confirmación**: Proceso interactivo de validación de datos

### 📊 Dashboard Inteligente
- **Vista Ejecutiva**: Métricas clave y KPIs financieros
- **Alertas Proactivas**: Notificaciones de vencimientos y límites
- **Análisis Predictivo**: Proyecciones basadas en historial
- **Categorización**: Machine learning para clasificación automática

### 💡 Funcionalidades Avanzadas

#### 🧠 Asistente Financiero IA
- Consultas en lenguaje natural sobre finanzas
- Sugerencias de optimización de gastos
- Detección de duplicados y anomalías

#### 🏦 Integración Bancaria
- Conciliación automática con estados de cuenta
- Programación de pagos
- Seguimiento de cash flow en tiempo real

#### 📈 Inteligencia de Proveedores
- Ranking de proveedores por métricas clave
- Alertas de oportunidades de negociación
- Comparativas de mercado

#### ✅ Cumplimiento Automático
- Generación de reportes para contadores
- Recordatorios fiscales
- Validación de requisitos por factura

---

## 🏗️ Arquitectura Técnica

### 📱 Frontend - Dashboard Web
```
┌─────────────────────────────────────┐
│           React Dashboard           │
├─────────────────────────────────────┤
│ • Charts & Analytics (Chart.js)    │
│ • Real-time Updates (Socket.io)    │
│ • Responsive Design (Tailwind)     │
│ • State Management (Redux/Zustand) │
└─────────────────────────────────────┘
```

### 🔄 Middleware - n8n Workflows
```
┌─────────────────────────────────────┐
│            n8n Workflows            │
├─────────────────────────────────────┤
│ • WhatsApp Webhook Handler          │
│ • OCR Processing Pipeline          │
│ • Data Validation & Enrichment     │
│ • Notification System              │
│ • Banking API Integration          │
│ • Scheduled Tasks & Alerts         │
└─────────────────────────────────────┘
```

### ⚙️ Backend - API Services
```
┌─────────────────────────────────────┐
│          Backend Services           │
├─────────────────────────────────────┤
│ • Node.js/Express API Server       │
│ • PostgreSQL Database              │
│ • Redis Cache & Sessions           │
│ • JWT Authentication               │
│ • OCR Service (Tesseract/Google)   │
│ • AI/ML Processing (OpenAI/Local)  │
└─────────────────────────────────────┘
```

### 💾 Base de Datos
```sql
-- Estructura principal de tablas
Companies, Users, Invoices, Suppliers, 
Categories, Payments, Analytics, Alerts
```

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: React 18+ con TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js / Recharts
- **State**: Zustand o Redux Toolkit
- **Build**: Vite

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **Authentication**: JWT + bcrypt
- **File Storage**: AWS S3 / MinIO

### n8n Integration
- **Webhooks**: WhatsApp Business API
- **OCR**: Google Vision API / Tesseract.js
- **AI**: OpenAI GPT-4 / Local Ollama
- **Banking**: Open Banking APIs
- **Notifications**: Email, SMS, Push

---

## 📦 Instalación y Configuración

### 1. Prerrequisitos
```bash
# Instalar dependencias del sistema
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- n8n
- Docker (opcional)
```

### 2. Configuración del Backend
```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/invoice-management-system.git
cd invoice-management-system/backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Configurar base de datos
npm run db:migrate
npm run db:seed

# Iniciar servidor
npm run dev
```

### 3. Configuración del Frontend
```bash
cd ../frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Iniciar desarrollo
npm run dev
```

### 4. Configuración de n8n
```bash
# Instalar n8n globalmente
npm install -g n8n

# Configurar variables de entorno para n8n
export N8N_BASIC_AUTH_ACTIVE=true
export N8N_BASIC_AUTH_USER=admin
export N8N_BASIC_AUTH_PASSWORD=tu_password

# Iniciar n8n
n8n start
```

---

## 🔄 Integración con n8n

### Workflows Principales

#### 1. 📱 WhatsApp Invoice Processing
```
Webhook (WhatsApp) → 
OCR Processing → 
Data Validation → 
Database Insert → 
Confirmation Message
```

#### 2. 🔔 Daily Alerts & Reports
```
Schedule Trigger → 
Query Pending Invoices → 
Generate Alert → 
Send Notifications → 
Update Analytics
```

#### 3. 🏦 Bank Reconciliation
```
Bank API Trigger → 
Match Transactions → 
Update Payment Status → 
Generate Insights → 
Notify Discrepancies
```

### Configuración de Nodos n8n

#### WhatsApp Webhook Node
```json
{
  "method": "POST",
  "path": "/webhook/whatsapp",
  "responseMode": "onReceived",
  "options": {}
}
```

#### OCR Processing Node (HTTP Request)
```json
{
  "method": "POST",
  "url": "http://localhost:3001/api/ocr/process",
  "sendQuery": false,
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{$node[\"Auth\"].json[\"token\"]}}"
      }
    ]
  }
}
```

---

## 🎨 Frontend Dashboard

### Componentes Principales

#### 📊 Analytics Dashboard
```typescript
// Métricas principales
- Total de gastos mensuales
- Facturas pendientes de pago
- Top 5 proveedores
- Tendencias por categoría
- Proyecciones de cash flow
```

#### 📋 Invoice Management
```typescript
// Gestión de facturas
- Lista de facturas con filtros
- Detalles de factura individual
- Estados de pago
- Documentos adjuntos
- Historial de cambios
```

#### 🏪 Supplier Analytics
```typescript
// Análisis de proveedores
- Ranking por performance
- Historial de precios
- Términos de pago
- Alertas de negociación
```

#### ⚙️ Settings & Configuration
```typescript
// Configuración
- Perfil de empresa
- Categorías personalizadas
- Reglas de automatización
- Integraciones activas
```

---

## 💰 Modelo de Precios (EUR)

### 🆓 Plan Gratuito
- **Precio**: 0€/mes
- **Límite**: 50 facturas/mes
- **Funciones**: Procesamiento básico OCR, Dashboard simple

### 💼 Plan Professional
- **Precio**: 29€/mes
- **Límite**: Facturas ilimitadas
- **Funciones**: Análisis avanzado, Integraciones bancarias, Alertas

### 🏢 Plan Enterprise
- **Precio**: 79€/mes
- **Límite**: Multi-empresa
- **Funciones**: IA avanzada, API access, Soporte prioritario, Custom workflows

---

## 🚦 API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/refresh-token
```

### Invoices
```
GET    /api/invoices          # Listar facturas
POST   /api/invoices          # Crear factura
GET    /api/invoices/:id      # Obtener factura
PUT    /api/invoices/:id      # Actualizar factura
DELETE /api/invoices/:id      # Eliminar factura
```

### OCR Processing
```
POST /api/ocr/process         # Procesar imagen
GET  /api/ocr/status/:jobId   # Estado del procesamiento
```

### Analytics
```
GET /api/analytics/dashboard  # Métricas del dashboard
GET /api/analytics/expenses   # Análisis de gastos
GET /api/analytics/suppliers  # Análisis de proveedores
```

---

## 🔐 Seguridad

### Autenticación y Autorización
- JWT tokens con refresh
- Rate limiting por IP
- Validación de entrada sanitizada
- CORS configurado correctamente

### Protección de Datos
- Encriptación de datos sensibles
- Backup automático de base de datos
- Logs de auditoría
- Cumplimiento GDPR

---

## 📈 Roadmap

### Fase 1 (Q1 2025) ✅
- [x] MVP con procesamiento OCR básico
- [x] Dashboard fundamental
- [x] Integración WhatsApp

### Fase 2 (Q2 2025) 🔄
- [ ] IA avanzada para análisis predictivo
- [ ] Integraciones bancarias
- [ ] App móvil nativa

### Fase 3 (Q3 2025) 📋
- [ ] Marketplace de proveedores
- [ ] Funciones colaborativas
- [ ] API pública

### Fase 4 (Q4 2025) 🚀
- [ ] Expansión internacional
- [ ] Integraciones ERP
- [ ] Funciones de e-commerce

---

## 🤝 Contribución

### Desarrollo Local
1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Añadir nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código
- ESLint + Prettier configurados
- Pruebas unitarias obligatorias
- Documentación de API actualizada
- Commit messages siguiendo Conventional Commits

---

## 📞 Soporte

### Contacto
- **Email**: pedroscarpati@proton.me

### Reportar Bugs
Utiliza GitHub Issues con las siguientes etiquetas:
- `bug`: Para errores en el código
- `enhancement`: Para mejoras
- `question`: Para consultas
- `documentation`: Para mejoras en docs

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para más detalles.

---

## 🙏 Agradecimientos

- **Tesseract.js** por OCR de código abierto
- **n8n** por la plataforma de automatización
- **OpenAI** por las capacidades de IA
- **WhatsApp Business API** por la integración de mensajería

---

*Desarrollado con ❤️ para revolucionar la gestión financiera de las PYMEs*
