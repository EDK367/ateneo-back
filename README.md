# Ateneo Backend

## 1. Descripción del proyecto

Ateneo Backend es un sistema de gestión documental (SGD) y almacenamiento distribuido desarrollado para la organización, catalogación, consulta y compartición colaborativa de archivos y carpetas institucionales.

### Propósito principal
Centralizar la administración y persistencia documental de la plataforma Ateneo, garantizando alta disponibilidad, consistencia en la jerarquía de directorios, control de acceso basado en roles (RBAC), descarga eficiente mediante flujos de streaming binario y trazabilidad exhaustiva de operaciones de usuario.

### Problema que resuelve
Resuelve la dispersión operativa y la falta de control en el almacenamiento institucional mediante:
* Estructuración jerárquica de carpetas utilizando un modelo de ancestros indexados que optimiza la navegación y las búsquedas en profundidad arbitraria.
* Carga, almacenamiento y streaming de documentos en formatos texto plano y Markdown (.txt y .md) apoyado en MongoDB GridFS, evitando saturación de memoria en el servidor.
* Descarga directa en streaming y previsualización inmediata de contenidos crudos (raw) sin intermediación de almacenamiento local efímero.
* Mecanismo granular de compartición de recursos (archivos y carpetas) entre usuarios con niveles diferenciados de autorización: lectura (read), comentario (comment) y edición (edit).
* Papelera de reciclaje segura con control de raíz de eliminación (trashRootId), permitiendo restauraciones consistentes en cascada o purga permanente física de GridFS y metadatos.
* Auditoría y registro continuo de actividades operativas (carga, descarga, movimiento, renombrado, compartición, eliminación y restauración).
* Cálculo dinámico de cuotas de almacenamiento y generación de reportes analíticos para el usuario y métricas globales para administradores.
* Control de seguridad y autenticación sin estado mediante JSON Web Tokens (JWT) firmados criptográficamente.

### Tecnologías principales
* TypeScript
* Node.js LTS
* NestJS
* MongoDB con ReplicaSet (rs0)
* Mongoose
* MongoDB GridFS (bucket contents)
* Passport JWT y Bcrypt
* Scalar API Reference / OpenAPI (Swagger)
* Docker y Docker Compose

---

## 2. Arquitectura

El backend implementa una arquitectura modular en capas (**Modular Architecture**) organizada por dominios funcionales (**Package by Feature**), desacoplando los controladores de transporte, los servicios de reglas de negocio, los esquemas de persistencia y la capa de almacenamiento en GridFS.

### Capas del sistema
1. **Capa de Controladores / API (`controller`)**: Controladores REST decorados con `@Controller` que exponen endpoints HTTP versionados bajo `/api/v1`, gestionan interceptores multipart (`FileInterceptor`), transforman parámetros y exponen la especificación OpenAPI.
2. **Capa de Seguridad y Filtros (`auth/guards`, `auth/decorators`)**: Guardián de autenticación global `JwtAuthGuard` con soporte de rutas públicas `@Public()`, validación de privilegios RBAC `@Roles(...)` con `RolesGuard`, y extracción tipada del usuario mediante `@CurrentUser()`.
3. **Capa de Lógica de Negocio (`service`)**: Servicios inyectables con reglas empresariales (validación de nombres únicos por ubicación, resolución de ancestros, orquestación de permisos, cálculo de cuotas y registro de auditoría).
4. **Capa de Transferencia y Validación (`dto`)**: Clases de transferencia de datos validadas automáticamente en tiempo de ejecución con `class-validator` y transformadas con `class-transformer` a través del `ValidationPipe` global.
5. **Capa de Persistencia NoSQL (`schemas`)**: Modelos y esquemas de Mongoose con índices compuestos, índices parciales para borrado lógico e índices de texto para búsqueda rápida.
6. **Capa de Almacenamiento Binario (`gridfs.service.ts`)**: Abstracción del bucket GridFS de MongoDB (`contents`) mediante flujos de lectura (`openDownloadStream`) y escritura (`openUploadStream`).
7. **Capa de Auditoría y Reportes (`activity`, `reports`)**: Registro cronológico inmutable de eventos del sistema y canalizaciones de agregación para métricas de almacenamiento y tipos de archivo.

### Flujo de comunicación
* Las solicitudes HTTP entrantes pasan por el `ValidationPipe` global, donde se sanitizan y validan las propiedades del cuerpo y los parámetros de consulta.
* El guardián `JwtAuthGuard` valida el token Bearer provisto en los encabezados HTTP; si el endpoint está restringido por rol, `RolesGuard` corrobora los privilegios del usuario.
* El controlador recibe la petición y delega la operación al servicio correspondiente.
* El servicio aplica las validaciones de negocio, interactúa con Mongoose para consultar o modificar documentos BSON y, en caso de archivos, invoca a `GridFsService` para gestionar los chunks binarios.
* Cada operación relevante (subida, movimiento, compartición o eliminación) registra automáticamente una entrada en la colección de actividades a través de `ActivityService`.
* En operaciones sobre archivos, el servicio actualiza de manera atómica el campo `storageUsedBytes` del usuario propietario.
* El controlador retorna la respuesta estructurada en formato JSON o un flujo binario en streaming (`StreamableFile`).

---

## 3. Estructura del proyecto

```text
ateneo-back/
├── compose.yml                     # Definición de servicios Docker (MongoDB ReplicaSet y Mongo Express)
├── mongo-docker/                   # Archivos de configuración y build de MongoDB
│   ├── Dockerfile                  # Imagen personalizada de MongoDB con soporte de ReplicaSet
│   └── keyfile                     # Archivo de clave interna para autenticación del cluster
├── package.json                    # Manifiesto de dependencias, scripts de ejecución y build
├── pnpm-lock.yaml                  # Archivo de bloqueo de versiones de dependencias
├── src/
│   ├── main.ts                     # Entrada de la aplicación, configuración de Scalar, Swagger y CORS
│   ├── app.module.ts               # Módulo raíz que integra módulos de dominio y base de datos
│   ├── app.controller.ts           # Controlador base de comprobación de estado
│   ├── app.service.ts              # Servicio base
│   ├── activity/                   # Módulo de auditoría y trazabilidad de actividades
│   │   ├── activity.controller.ts  # Endpoints de consulta de actividad reciente
│   │   ├── activity.module.ts      # Definición e inyección del módulo de actividad
│   │   ├── activity.service.ts     # Registro y recuperación de bitácora de eventos
│   │   └── schemas/
│   │       └── activity.schema.ts  # Esquema Mongoose para historial de acciones
│   ├── auth/                       # Módulo de autenticación y autorización
│   │   ├── auth.controller.ts      # Endpoints de registro, inicio de sesión y perfil
│   │   ├── auth.module.ts          # Integración de JwtModule y estrategias Passport
│   │   ├── auth.service.ts         # Validación de credenciales y generación de JWT
│   │   ├── decorators/             # Decoradores (@Public, @Roles, @CurrentUser)
│   │   ├── dto/                    # DTOs de login y registro
│   │   ├── guards/                 # Guardianes JwtAuthGuard y RolesGuard
│   │   └── strategies/             # Estrategia de autenticación JwtStrategy
│   ├── config/                     # Configuración y validación del entorno
│   │   └── env.validation.ts       # Esquema de validación estricta con Joi
│   ├── database/                   # Módulo de inicialización y seed de datos
│   │   ├── seed.module.ts          # Módulo con esquemas requeridos para seed
│   │   ├── seed.service.ts         # Lógica de limpieza y carga masiva de datos funcionales
│   │   └── seed.ts                 # Punto de entrada para ejecución standalone del seed
│   ├── files/                      # Módulo de gestión y streaming de archivos
│   │   ├── file.controller.ts      # Endpoints de subida, descarga, streaming, tags y renombrado
│   │   ├── file.module.ts          # Registro del módulo de archivos y GridFS
│   │   ├── file.service.ts         # Reglas de negocio de archivos y actualización de cuotas
│   │   ├── gridfs.service.ts       # Operaciones de lectura y escritura sobre GridFSBucket
│   │   ├── dto/                    # DTOs de subida, movimiento y renombrado
│   │   └── schemas/
│   │       └── file.schema.ts      # Esquema Mongoose de metadatos de archivos
│   ├── folders/                    # Módulo de carpetas y jerarquía documental
│   │   ├── folder.controller.ts    # Endpoints de creación, navegación y movimiento
│   │   ├── folder.module.ts        # Registro del módulo de carpetas
│   │   ├── folder.service.ts       # Manejo del árbol jerárquico y validación de ancestros
│   │   ├── dto/                    # DTOs de carpetas
│   │   └── schemas/
│   │       └── folder.schema.ts    # Esquema Mongoose con índices de árbol y exclusión de papelera
│   ├── reports/                    # Módulo de analítica y reportes de almacenamiento
│   │   ├── report.controller.ts    # Endpoints de estadísticas por usuario y globales
│   │   ├── report.module.ts        # Registro del módulo de reportes
│   │   └── report.service.ts       # Agregaciones de métricas y porcentajes de cuota
│   ├── shares/                     # Módulo de compartición colaborativa de recursos
│   │   ├── shares.controller.ts    # Endpoints de administración de compartición y permisos
│   │   ├── shares.module.ts        # Registro del módulo de compartición
│   │   ├── shares.service.ts       # Lógica de asignación y verificación de permisos
│   │   ├── dto/                    # DTOs de compartición
│   │   └── schemas/
│   │       └── share.schema.ts     # Esquema Mongoose para recursos compartidos
│   ├── trash/                      # Módulo de papelera de reciclaje y purga
│   │   ├── trash.controller.ts     # Endpoints de listado, restauración, purga y vaciado
│   │   ├── trash.module.ts         # Registro del módulo de papelera
│   │   └── trash.service.ts        # Lógica de borrado lógico y eliminación física en GridFS
│   └── user/                       # Módulo de administración de usuarios
│       ├── user.controller.ts      # Endpoints administrativos de usuarios
│       ├── user.module.ts          # Registro del módulo de usuarios
│       ├── user.service.ts         # Lógica de negocio y mantenimiento de cuentas
│       ├── dto/                    # DTOs de usuario
│       └── schemas/
│           └── user.schema.ts      # Esquema Mongoose de usuarios y cuota de almacenamiento
├── test/                           # Pruebas automatizadas del sistema
├── tsconfig.json                   # Configuración de compilación TypeScript
└── vitest.config.ts                # Configuración de pruebas unitarias y de integración
```

---

## 4. Tecnologías y dependencias

| Componente | Tecnología | Versión / Detalle | Propósito en el proyecto |
| :--- | :--- | :--- | :--- |
| **Lenguaje** | TypeScript | 6.0+ | Tipado estático y desarrollo de la aplicación |
| **Entorno de Ejecución**| Node.js | LTS (>= 20.x) | Motor de ejecución del servidor |
| **Framework Base** | NestJS | 12.0+ | Arquitectura modular, inyección de dependencias y controladores |
| **Base de Datos** | MongoDB | 8.x (ReplicaSet rs0) | Motor de base de datos NoSQL con soporte de transacciones |
| **ODM / Modelado** | Mongoose / `@nestjs/mongoose`| 9.1+ / 12.0+ | Mapeo de objetos BSON, esquemas, índices y validación |
| **Almacenamiento Binario** | MongoDB GridFS | Nativo (`contents`) | Almacenamiento y streaming de archivos grandes en bloques |
| **Seguridad y Cifrado**| Bcrypt | 6.0+ | Hash seguro de contraseñas con factor de coste |
| **Autenticación** | Passport JWT / `@nestjs/jwt` | 0.7+ / 12.0+ | Generación, firma y verificación de tokens de sesión |
| **Validación de Entorno**| Joi | 18.2+ | Validación estricta de variables de entorno al arranque |
| **Validación de DTOs** | Class-Validator / Transformer| 0.15+ / 0.5+ | Validación declarativa de cargas útiles en peticiones HTTP |
| **Documentación API** | Scalar API Reference / Swagger | 1.2+ / 12.0+ | Especificación OpenAPI y portal interactivo de la API |
| **Contenedores** | Docker / Docker Compose | Compose v2 | Orquestación del cluster MongoDB y Mongo Express |
| **Pruebas** | Vitest | 4.1+ | Ejecución rápida de pruebas unitarias y de extremo a extremo |
| **Linter y Calidad** | Oxlint | 1.58+ | Análisis estático de código tipado de alto rendimiento |

---

## 5. Requisitos previos

Para compilar y ejecutar el proyecto localmente se requiere:
* **Node.js**: Versión 20.x LTS o superior instalada.
* **PNPM**: Versión 9.x o superior instalada globalmente (`npm install -g pnpm`).
* **Docker y Docker Compose**: Instalados y con el servicio Docker activo.
* **Git**: Para el control de versiones del repositorio.

---

## 6. Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/EDK367/ateneo-back.git
cd ateneo-back
```

### 2. Instalar dependencias
Instale los paquetes mediante el gestor PNPM:
```bash
pnpm install
```

### 3. Configurar variables de entorno
Copie la plantilla de variables de entorno y ajuste los valores requeridos:
```bash
cp .env.example .env
```
Consulte la sección (#7-variables-de-entorno) para el detalle de cada variable.

### 4. Iniciar servicios en Docker
Inicie el cluster de MongoDB configurado con ReplicaSet (`rs0`) y el visor Mongo Express:
```bash
docker compose up -d
```
Verifique que los contenedores estén en ejecución y en estado saludable:
```bash
docker compose ps
```

### 5. Inicializar la base de datos (Seed de datos)
Ejecute el script de seed para limpiar colecciones previas y poblar la base de datos con una estructura completa de usuarios, carpetas jerárquicas, archivos reales en GridFS, recursos compartidos, registros de papelera y auditoría de actividades:
```bash
pnpm run seed
```

### 6. Ejecutar la aplicación

#### Modo desarrollo (con recarga automática):
```bash
pnpm run start:dev
```

#### Modo producción:
```bash
pnpm run build
pnpm run start:prod
```

---

## 7. Variables de entorno

Las propiedades de configuración están validadas mediante Joi en `src/config/env.validation.ts` y se definen en el archivo `.env`.

| Variable | Descripción | Obligatoria | Ejemplo seguro |
| :--- | :--- | :--- | :--- |
| `PORT` | Puerto HTTP donde escuchará el servidor | No (def: 3000) | `3000` |
| `DB_USER` | Usuario administrador raíz de MongoDB | Sí | `admin` |
| `DB_PASSWORD` | Contraseña del usuario administrador de MongoDB | Sí | `admin` |
| `DB_NAME` | Nombre de la base de datos principal | Sí | `ateneo_db` |
| `DB_MONGO_URI` | Cadena de conexión URI a MongoDB con ReplicaSet | Sí | `mongodb://admin:admin@localhost:27017/?replicaSet=rs0&directConnection=true` |
| `JWT_SECRET` | Clave secreta para firma criptográfica HMAC-SHA de tokens JWT (mínimo 32 caracteres) | Sí | `c+Ic2Le3cEx2XnY7MrPrdXfFx3V5l6bNkUlmUdPIGzIhrKdcarWpkkH7xTplthAKb7fVjOsZ1d3l5H70bUqACQ==` |
| `JWT_EXPIRES_IN` | Tiempo de vida del token de acceso | No (def: 1d) | `3600000` |
| `FRONTEND_URL` | Origen frontend autorizado para solicitudes de intercambio CORS | No (def: 4200) | `http://localhost:4200` |
| `SEED_ON_BOOT` | Ejecución automática del seed durante el arranque de la aplicación (`true`/`false`) | No (def: false)| `false` |

---

## 8. API

### Documentación interactiva
El proyecto cuenta con documentación OpenAPI 3.0 visualizada mediante la interfaz moderna de Scalar:
* Portal interactivo de la API: `http://localhost:3000/docs`
* Especificación OpenAPI en formato JSON crudo: `http://localhost:3000/api`

### Resumen de rutas principales

Todos los endpoints (con excepción del inicio de sesión y registro) requieren autenticación mediante encabezado HTTP:
`Authorization: Bearer <TOKEN_JWT>`

| Módulo | Método | Endpoint | Rol Requerido | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Público | Registro de nueva cuenta de usuario |
| **Auth** | `POST` | `/api/v1/auth/login` | Público | Inicio de sesión y obtención de token JWT |
| **Auth** | `GET` | `/api/v1/auth/profile` | Autenticado | Obtención de los datos del usuario en sesión |
| **Users** | `GET` | `/api/v1/user` | User / Admin | Listado general de usuarios registrados |
| **Users** | `POST` | `/api/v1/user` | Admin | Creación directa de usuario por administrador |
| **Users** | `PUT` | `/api/v1/user/:id` | Admin | Actualización completa de datos de usuario |
| **Users** | `PATCH` | `/api/v1/user/:id` | Admin | Actualización parcial de datos de usuario |
| **Users** | `DELETE`| `/api/v1/user/:id` | Admin | Desactivación de usuario (soft delete) |
| **Folders**| `POST` | `/api/v1/folders` | Autenticado | Creación de carpeta en la raíz o subcarpeta |
| **Folders**| `GET` | `/api/v1/folders/content` | Autenticado | Obtención del contenido de una carpeta o de la raíz |
| **Folders**| `PATCH` | `/api/v1/folders/:id/move` | Autenticado | Traslado de carpeta a un nuevo destino |
| **Folders**| `PATCH` | `/api/v1/folders/:id/rename`| Autenticado | Renombramiento de carpeta existente |
| **Folders**| `DELETE`| `/api/v1/folders/:id` | Autenticado | Envío de carpeta y sus descendientes a papelera |
| **Files** | `POST` | `/api/v1/files/upload` | Autenticado | Carga multipart de archivo (.txt / .md) hacia GridFS |
| **Files** | `GET` | `/api/v1/files/search` | Autenticado | Búsqueda y filtrado de archivos por término, tipo y etiquetas |
| **Files** | `GET` | `/api/v1/files/recent` | Autenticado | Consulta de los archivos recientes del usuario |
| **Files** | `GET` | `/api/v1/files/:id/raw` | Autenticado | Previsualización en texto crudo del archivo |
| **Files** | `GET` | `/api/v1/files/:id/download`| Autenticado| Descarga directa en streaming binario con headers |
| **Files** | `PATCH` | `/api/v1/files/:id/rename` | Autenticado | Renombramiento de archivo |
| **Files** | `PATCH` | `/api/v1/files/:id/move` | Autenticado | Movimiento de archivo a otra carpeta destino |
| **Files** | `PATCH` | `/api/v1/files/:id/tags` | Autenticado | Actualización de etiquetas de búsqueda |
| **Files** | `DELETE`| `/api/v1/files/:id` | Autenticado | Envío de archivo a la papelera |
| **Shares** | `POST` | `/api/v1/shares` | Autenticado | Compartición de archivo o carpeta con un usuario |
| **Shares** | `GET` | `/api/v1/shares/shared-with-me`| Autenticado| Listado de recursos compartidos con el usuario |
| **Shares** | `GET` | `/api/v1/shares/shared-by-me` | Autenticado | Listado de recursos que el usuario ha compartido |
| **Shares** | `PATCH` | `/api/v1/shares/:id/authorization`| Autenticado| Modificación del nivel de permiso (read, comment, edit) |
| **Shares** | `DELETE`| `/api/v1/shares/:id` | Autenticado | Revocación de acceso a recurso compartido |
| **Trash** | `GET` | `/api/v1/trash` | Autenticado | Listado de elementos en papelera de reciclaje |
| **Trash** | `POST` | `/api/v1/trash/restore/:id` | Autenticado | Restauración de archivo o carpeta desde papelera |
| **Trash** | `DELETE`| `/api/v1/trash/purge/:id` | Autenticado | Eliminación definitiva física de elemento |
| **Trash** | `DELETE`| `/api/v1/trash/empty` | Autenticado | Vaciado completo de la papelera |
| **Activity**| `GET`| `/api/v1/activity` | Autenticado | Consulta cronológica de acciones y auditoría |
| **Reports**| `GET` | `/api/v1/report/stats` | Autenticado | Métricas de uso de cuota y desglose del usuario |
| **Reports**| `GET` | `/api/v1/report/global` | Admin | Métricas globales del cluster para administradores |
| **Reports**| `GET` | `/api/v1/report/by-type` | Autenticado | Cantidad de archivos agrupados por tipo (.txt, .md) |
| **Reports**| `GET` | `/api/v1/report/by-date-range` | Autenticado | Archivos almacenados dentro de un rango de fechas |
| **Reports**| `GET` | `/api/v1/report/most-active-files` | Autenticado | Archivos con mayor cantidad de operaciones registradas |
| **Reports**| `GET` | `/api/v1/report/top-users-files` | Autenticado | Top 10 usuarios con mayor cantidad de archivos |
| **Reports**| `GET` | `/api/v1/report/top-users-shares` | Autenticado | Usuarios con mayor cantidad de recursos compartidos |
| **Reports**| `GET` | `/api/v1/report/shared-by-user/:userId`| Autenticado| Recursos compartidos por un usuario seleccionado |
| **Reports**| `GET` | `/api/v1/report/shared-with-user/:userId`| Autenticado| Recursos recibidos por un usuario seleccionado |
| **Reports**| `GET` | `/api/v1/report/never-shared` | Autenticado | Archivos que nunca han sido compartidos |
| **Reports**| `GET` | `/api/v1/report/folders-most-files` | Autenticado | Carpetas con mayor cantidad de archivos |
| **Reports**| `GET` | `/api/v1/report/files-most-shared-users`| Autenticado| Archivos compartidos con mayor cantidad de usuarios |

---

## 9. Base de datos

### Motor y modelo de datos
* **Motor**: MongoDB 8.x con soporte de ReplicaSet de un solo nodo (`rs0`), configurado para habilitar transacciones ACID de documentos cuando sea requerido.
* **Almacenamiento Híbrido**: Metadatos indexados en colecciones BSON estándar y archivos binarios alojados en colecciones GridFS (`contents.files` y `contents.chunks`).
* **Visor Web**: Mongo Express disponible en `http://localhost:8081` para inspección interactiva de datos.

### Colecciones del sistema
1. `users`: Cuentas de usuario, credenciales con hash Bcrypt, roles de acceso (`admin` y `user`) y bytes de cuota consumidos (`storageUsedBytes`).
2. `folders`: Jerarquía de directorios con referencias `ownerId`, `parentId`, arreglo indexado de `ancestors` y campos de borrado lógico (`deletedAt`, `trashRootId`).
3. `filedocs`: Metadatos de archivos indexados, tamaño en bytes, arreglo de etiquetas (`tags`), tipo de extensión (`txt` o `md`) y referencia `gridFsId`.
4. `contents.files` y `contents.chunks`: Almacenamiento binario fragmentado nativo de MongoDB GridFS.
5. `shares`: Relaciones de compartición que vinculan un recurso (`file` o `folder`) con un beneficiario (`sharedWithId`) y un nivel de permiso (`read`, `comment`, `edit`).
6. `activities`: Bitácora inmutable de eventos operacionales con detalles contextuales, marcas de tiempo y tipos de recurso afectados.

### Datos del Seed para presentación funcional
El proceso de inicialización (`pnpm run seed`) limpia colecciones obsoletas y genera un ecosistema de datos listo para demostración funcional:

#### Cuentas de usuario inicializadas:
Todas las cuentas tienen configurada la contraseña uniforme: `Password`

| Usuario | Correo Electrónico | Rol | Perfil y Propósito |
| :--- | :--- | :--- | :--- |
| `admin` | `admin@ateneo.com` | `admin` | Administrador general de plataforma y políticas |
| `edk` | `edk@ateneo.com` | `user` | Usuario principal docente e investigador |
| `maria.lopez` | `maria.lopez@ateneo.com`| `user` | Coordinadora de vinculación comunitaria y extensión |
| `carlos.mendoza`| `carlos.mendoza@ateneo.com`| `user`| Investigador y autor de publicaciones científicas |
| `user` | `user@ateneo.com` | `user` | Usuario estándar para verificación de permisos |

#### Estructura de datos generada:
* **Carpetas multinivel**: Estructuras organizadas por departamentos con subcarpetas anidadas y cálculo estricto de ancestros.
* **Archivos reales en GridFS**: Documentos Markdown (.md) y texto plano (.txt) con contenido técnico, académico y administrativo real, permitiendo descargas y previsualizaciones funcionales desde la interfaz.
* **Recursos compartidos activos**: Carpetas y archivos compartidos entre usuarios con permisos de lectura, comentario y edición colaborativa listos para exhibición en las vistas de recursos compartidos.
* **Papelera de reciclaje funcional**: Elementos borrados lógicamente que permiten verificar la restauración y la purga permanente física en vivo.
* **Bitácora de actividad**: Registro cronológico de acciones de subida, compartición y eliminación para alimentar el dashboard de métricas y la línea de tiempo.
* **Métricas de cuota calculadas**: Porcentajes de almacenamiento consumido calculados y actualizados de forma precisa para cada usuario.
