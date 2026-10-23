import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import { Types } from 'mongoose';
import { Role, User, UserDocument } from '../user/schemas/user.schema.js';
import { Folder, FolderDocument } from '../folders/schemas/folder.schema.js';
import { FileDoc, FileDocument, FileType } from '../files/schemas/file.schema.js';
import {
  Share,
  ShareDocument,
  SharePermission,
  ShareResourceType,
} from '../shares/schemas/share.schema.js';
import {
  Activity,
  ActivityAction,
  ActivityDocument,
  ActivityResourceType,
} from '../activity/schemas/activity.schema.js';
import { GridFsService } from '../files/gridfs.service.js';

interface SeededFileConfig {
  name: string;
  type: FileType;
  content: string;
  folderId: Types.ObjectId | null;
  tags: string[];
  isTrash?: boolean;
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  private readonly defaultPasswordHash =
    '$2b$10$uTWCuPAV0Hn9F6O3v.MXSOLI8D4XsVYNpFzzka5ngctZnUI5paMN2';

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Folder.name)
    private readonly folderModel: Model<FolderDocument>,
    @InjectModel(FileDoc.name) private readonly fileModel: Model<FileDocument>,
    @InjectModel(Share.name) private readonly shareModel: Model<ShareDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    private readonly gridFsService: GridFsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_ON_BOOT === 'true') {
      await this.seed();
    }
  }

  async seed() {
    this.logger.log('Iniciando proceso de inicialización y seed de datos...');

    await this.cleanDatabase();

    const users = await this.seedUsers();
    const folders = await this.seedFolders(users);
    const files = await this.seedFiles(users, folders);
    await this.seedShares(users, folders, files);
    await this.seedActivities(users, folders, files);
    await this.updateUserStorageMetrics(users);

    this.logger.log(
      'Base de datos inicializada exitosamente con datos funcionales de producción.',
    );
  }

  private async cleanDatabase(): Promise<void> {
    this.logger.log('Limpiando colecciones anteriores...');

    await Promise.all([
      this.activityModel.deleteMany({}),
      this.shareModel.deleteMany({}),
      this.fileModel.deleteMany({}),
      this.folderModel.deleteMany({}),
      this.userModel.deleteMany({}),
    ]);

    const db = this.connection.db;
    if (db) {
      await Promise.all([
        db.collection('contents.files').deleteMany({}),
        db.collection('contents.chunks').deleteMany({}),
      ]);
    }

    this.logger.log('Colecciones y bucket GridFS limpiados con éxito.');
  }

  private async seedUsers(): Promise<Record<string, UserDocument>> {
    this.logger.log('Creando usuarios del sistema...');

    const usersData = [
      {
        key: 'admin',
        username: 'admin',
        email: 'admin@ateneo.com',
        role: Role.Admin,
      },
      {
        key: 'edk',
        username: 'edk',
        email: 'edk@ateneo.com',
        role: Role.User,
      },
      {
        key: 'maria',
        username: 'maria',
        email: 'maria.lopez@ateneo.com',
        role: Role.User,
      },
      {
        key: 'carlos',
        username: 'carlos',
        email: 'carlos.mendoza@ateneo.com',
        role: Role.User,
      },
      {
        key: 'user',
        username: 'user',
        email: 'user@ateneo.com',
        role: Role.User,
      },
    ];

    const users: Record<string, UserDocument> = {};

    for (const item of usersData) {
      const user = await this.userModel.create({
        username: item.username,
        email: item.email.toLowerCase(),
        password: this.defaultPasswordHash,
        role: item.role,
        isActive: true,
        storageUsedBytes: 0,
      });
      users[item.key] = user;
      this.logger.log(`Usuario creado: ${user.username} (${user.email})`);
    }

    return users;
  }

  private async seedFolders(
    users: Record<string, UserDocument>,
  ): Promise<Record<string, FolderDocument>> {
    this.logger.log('Estructurando carpetas por usuario...');
    const folders: Record<string, FolderDocument> = {};

    const edkId = users.edk._id;

    const fEdkInv = await this.folderModel.create({
      name: 'Investigación y Desarrollo',
      ownerId: edkId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_inv'] = fEdkInv;

    const fEdkArq = await this.folderModel.create({
      name: 'Arquitectura de Software',
      ownerId: edkId,
      parentId: fEdkInv._id,
      ancestors: [fEdkInv._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_arq'] = fEdkArq;

    const fEdkIa = await this.folderModel.create({
      name: 'Modelos de Inteligencia Artificial',
      ownerId: edkId,
      parentId: fEdkInv._id,
      ancestors: [fEdkInv._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_ia'] = fEdkIa;

    const fEdkAcad = await this.folderModel.create({
      name: 'Gestión Académica',
      ownerId: edkId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_acad'] = fEdkAcad;

    const fEdkPlan = await this.folderModel.create({
      name: 'Planificación Semestral',
      ownerId: edkId,
      parentId: fEdkAcad._id,
      ancestors: [fEdkAcad._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_plan'] = fEdkPlan;

    const fEdkActas = await this.folderModel.create({
      name: 'Actas y Evaluaciones',
      ownerId: edkId,
      parentId: fEdkAcad._id,
      ancestors: [fEdkAcad._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_actas'] = fEdkActas;

    const fEdkRec = await this.folderModel.create({
      name: 'Plantillas y Recursos',
      ownerId: edkId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['edk_rec'] = fEdkRec;

    const trashFolderEdkId = new Types.ObjectId();
    const fEdkTrash = await this.folderModel.create({
      _id: trashFolderEdkId,
      name: 'Borradores Descartados 2025',
      ownerId: edkId,
      parentId: null,
      ancestors: [],
      deletedAt: new Date(Date.now() - 3600000 * 24 * 3),
      trashRootId: trashFolderEdkId,
    });
    folders['edk_trash'] = fEdkTrash;

    const adminId = users.admin._id;

    const fAdminPol = await this.folderModel.create({
      name: 'Políticas Institucionales',
      ownerId: adminId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['admin_pol'] = fAdminPol;

    const fAdminSeg = await this.folderModel.create({
      name: 'Seguridad y Privacidad',
      ownerId: adminId,
      parentId: fAdminPol._id,
      ancestors: [fAdminPol._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['admin_seg'] = fAdminSeg;

    const fAdminAud = await this.folderModel.create({
      name: 'Auditoría y Cumplimiento',
      ownerId: adminId,
      parentId: fAdminPol._id,
      ancestors: [fAdminPol._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['admin_aud'] = fAdminAud;

    const trashFolderAdminId = new Types.ObjectId();
    const fAdminTrash = await this.folderModel.create({
      _id: trashFolderAdminId,
      name: 'Registros Obsoletos Servidores',
      ownerId: adminId,
      parentId: null,
      ancestors: [],
      deletedAt: new Date(Date.now() - 3600000 * 24 * 7),
      trashRootId: trashFolderAdminId,
    });
    folders['admin_trash'] = fAdminTrash;

    const mariaId = users.maria._id;

    const fMariaProj = await this.folderModel.create({
      name: 'Proyectos de Vinculación',
      ownerId: mariaId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['maria_proj'] = fMariaProj;

    const fMariaTall = await this.folderModel.create({
      name: 'Talleres Comunitarios',
      ownerId: mariaId,
      parentId: fMariaProj._id,
      ancestors: [fMariaProj._id],
      deletedAt: null,
      trashRootId: null,
    });
    folders['maria_tall'] = fMariaTall;

    const carlosId = users.carlos._id;

    const fCarlosPub = await this.folderModel.create({
      name: 'Publicaciones Científicas',
      ownerId: carlosId,
      parentId: null,
      ancestors: [],
      deletedAt: null,
      trashRootId: null,
    });
    folders['carlos_pub'] = fCarlosPub;

    return folders;
  }

  private async seedFiles(
    users: Record<string, UserDocument>,
    folders: Record<string, FolderDocument>,
  ): Promise<Record<string, FileDocument>> {
    this.logger.log('Subiendo archivos funcionales a GridFS...');
    const files: Record<string, FileDocument> = {};

    const edkFiles: Array<{ key: string; config: SeededFileConfig }> = [
      {
        key: 'edk_arq_backend',
        config: {
          name: 'diseno-arquitectura-backend.md',
          type: FileType.Md,
          folderId: folders.edk_arq._id,
          tags: ['arquitectura', 'backend', 'nestjs', 'mongodb'],
          content: `# Sistema Ateneo - Especificación de Arquitectura Backend

## 1. Visión General
El backend de Ateneo está construido como un servicio modular sobre NestJS y MongoDB. Implementa persistencia híbrida combinando documentos BSON y almacenamiento de archivos binarios mediante GridFS.

## 2. Componentes Clave
- **Autenticación**: JWT con estrategia Passport y control de acceso basado en roles (RBAC).
- **Gestor de Contenidos**: Streaming directo desde GridFS sin saturar memoria RAM.
- **Jerarquía de Carpetas**: Modelo de ancestros indexado para navegación rápida y consultas O(1).
- **Papelera Segura**: Borrado lógico con identificación de raíz de eliminación (\`trashRootId\`).

## 3. Seguridad
Todas las rutas autenticadas requieren encabezado Bearer Token. Se validan esquemas mediante DTOs tipados estrictamente.`,
        },
      },
      {
        key: 'edk_arq_spec',
        config: {
          name: 'especificaciones-api-rest.txt',
          type: FileType.Txt,
          folderId: folders.edk_arq._id,
          tags: ['api', 'rest', 'especificaciones'],
          content: `ESPECIFICACIONES DE INTERFAZ REST - ATENEO BACKEND
==================================================
Prefijo global: /api/v1
Documentación interactiva: /docs (Scalar API Reference)

Endpoints Principales:
- POST   /auth/login        : Autenticación de usuarios
- GET    /folders/content   : Navegación de carpetas y listado de contenidos
- POST   /files/upload      : Subida multiparte (.txt, .md) hacia GridFS
- GET    /files/:id/raw     : Previsualización de texto plano
- GET    /files/:id/download: Descarga en streaming
- POST   /shares            : Compartir recursos con permisos (read, comment, edit)
- GET    /report/stats      : Métricas de almacenamiento del usuario`,
        },
      },
      {
        key: 'edk_ia_benchmark',
        config: {
          name: 'benchmark-modelos-nlp.md',
          type: FileType.Md,
          folderId: folders.edk_ia._id,
          tags: ['ia', 'benchmark', 'nlp', 'modelos'],
          content: `# Evaluación de Modelos de Lenguaje para Procesamiento Documental

## Objetivos del Estudio
Comparar la latencia de inferencia y la precisión en extracción de resúmenes sobre documentos técnicos indexados.

| Modelo | Latencia Promedio (ms) | Precisión F1 | Consumo Memoria |
| :--- | :--- | :--- | :--- |
| DistilBERT | 42 ms | 0.89 | 512 MB |
| RoBERTa-Base | 85 ms | 0.94 | 1.2 GB |
| MiniLM-L6 | 28 ms | 0.87 | 320 MB |

## Conclusiones
Para procesamiento en tiempo real dentro del pipeline de ingesta, MiniLM-L6 ofrece la mejor relación rendimiento/costo computacional.`,
        },
      },
      {
        key: 'edk_plan_silabo',
        config: {
          name: 'silabo-ingenieria-software.md',
          type: FileType.Md,
          folderId: folders.edk_plan._id,
          tags: ['academico', 'silabo', 'docencia', '2026'],
          content: `# Plan Curricular: Ingeniería de Software Avanzada

**Docente Titular**: Prof. Eduardo D. (edk)
**Período Académico**: Primer Semestre 2026

### Unidades de Aprendizaje:
1. **Patrones de Arquitectura y Diseño**: Microservicios, Modular Monolith y Domain-Driven Design.
2. **Bases de Datos Distribuidas**: Modelado NoSQL, réplicas y transacciones distribuidas.
3. **Seguridad y Criptografía Aplicada**: JWT, RBAC, hash criptográfico y auditoría.
4. **DevOps y Contenerización**: Docker multi-stage y pipelines CI/CD.`,
        },
      },
      {
        key: 'edk_acta_notas',
        config: {
          name: 'acta-primer-parcial.txt',
          type: FileType.Txt,
          folderId: folders.edk_actas._id,
          tags: ['calificaciones', 'actas', 'parcial'],
          content: `ACTA DE EVALUACIÓN - PRIMER PARCIAL 2026
Materia: Ingeniería de Software Avanzada
Total Alumnos Evaluados: 28
Promedio General: 8.85 / 10.0
Aprobados: 26
Reprobados: 2
Fecha de Asentamiento: 2026-10-15`,
        },
      },
      {
        key: 'edk_root_bienvenida',
        config: {
          name: 'bienvenida-ateneo.md',
          type: FileType.Md,
          folderId: null,
          tags: ['bienvenida', 'guia', 'inicio'],
          content: `# Bienvenido al Sistema de Gestión Documental Ateneo

Ateneo es la plataforma centralizada para la organización, catalogación, consulta y compartición de documentos institucionales.

### Funcionalidades Disponibles:
- Navegación ágil por árbol de carpetas con migas de pan.
- Carga segura de documentos Markdown (\`.md\`) y texto plano (\`.txt\`).
- Descarga directa en streaming y previsualización inmediata.
- Control colaborativo mediante recursos compartidos y niveles de permiso.
- Monitoreo de cuota y estadísticas de uso en tiempo real.`,
        },
      },
      {
        key: 'edk_root_notas',
        config: {
          name: 'notas-reunion-coordinacion.txt',
          type: FileType.Txt,
          folderId: null,
          tags: ['reunion', 'coordinacion', 'pendientes'],
          content: `NOTAS DE REUNIÓN DE COORDINACIÓN DOCENTE
Fecha: 2026-10-20
Temas tratados:
1. Migración de repositorios de archivos al nuevo cluster MongoDB.
2. Revisión de permisos en carpetas compartidas interdepartamentales.
3. Preparación de material para la presentación oficial del sistema.
Acuerdo: Verificar que la papelera y el módulo de reportes cuenten con datos consistentes.`,
        },
      },
      {
        key: 'edk_trash_file',
        config: {
          name: 'apuntes-antiguos-descartados.txt',
          type: FileType.Txt,
          folderId: null,
          tags: ['papelera', 'antiguo'],
          isTrash: true,
          content: `Apuntes preliminares de prueba realizados durante la etapa de desarrollo inicial. Elemento enviado a la papelera.`,
        },
      },
    ];

    for (const item of edkFiles) {
      files[item.key] = await this.createFileDocument(
        users.edk._id,
        item.config,
      );
    }

    const adminFiles: Array<{ key: string; config: SeededFileConfig }> = [
      {
        key: 'admin_pol_gestion',
        config: {
          name: 'politica-seguridad-informacion.md',
          type: FileType.Md,
          folderId: folders.admin_seg._id,
          tags: ['politicas', 'seguridad', 'institucional'],
          content: `# Política Institucional de Seguridad de la Información

## 1. Principio de Menor Privilegio
Todo usuario tiene acceso exclusivamente a los recursos que le son asignados de forma explícita o mediante carpetas compartidas con permisos específicos.

## 2. Gestión de Contraseñas y Tokens
- Las contraseñas se almacenan mediante hash Bcrypt con factor de costo 10.
- Los tokens JWT tienen expiración parametrizada y firma criptográfica HMAC-SHA.

## 3. Retención y Disposición de Archivos
Los documentos marcados para eliminación residen en la papelera de reciclaje hasta que el usuario o el administrador ordene su purga permanente.`,
        },
      },
      {
        key: 'admin_control_rbac',
        config: {
          name: 'matriz-permisos-rbac.txt',
          type: FileType.Txt,
          folderId: folders.admin_seg._id,
          tags: ['rbac', 'permisos', 'seguridad'],
          content: `MATRIZ DE ROLES Y CONTROL DE ACCESO
=====================================
Rol ADMIN:
- Gestión completa de usuarios (creación, edición, activación, soft delete).
- Visualización de estadísticas globales de almacenamiento y actividad.
- Vaciado y purga global de papelera de reciclaje.

Rol USER:
- Creación, renombramiento y desplazamiento de carpetas propias.
- Carga, descarga y previsualización de archivos propios.
- Compartición de recursos propios con permisos: READ, COMMENT, EDIT.
- Gestión de papelera personal y visualización de cuota de almacenamiento.`,
        },
      },
      {
        key: 'admin_manual_admin',
        config: {
          name: 'manual-operaciones-sistema.md',
          type: FileType.Md,
          folderId: null,
          tags: ['manual', 'administrador', 'operaciones'],
          content: `# Manual de Operaciones de Infraestructura Ateneo

Guía operativa para mantenimiento del cluster de base de datos y tareas de soporte.

### Tareas Periódicas:
- Monitoreo del estado del ReplicaSet (\`rs.status()\`).
- Verificación del volumen \`mongo_data\` y cuotas de almacenamiento.
- Supervisión del bucket de contenidos en GridFS.
- Generación de reportes de actividad mediante el endpoint global de métricas.`,
        },
      },
      {
        key: 'admin_trash_file',
        config: {
          name: 'registro-mantenimiento-2024.txt',
          type: FileType.Txt,
          folderId: folders.admin_trash._id,
          tags: ['logs', 'papelera', 'historico'],
          isTrash: true,
          content: `Historial de mantenimiento preventivo ejecutado en el año 2024. Archivado para purga periódica.`,
        },
      },
    ];

    for (const item of adminFiles) {
      files[item.key] = await this.createFileDocument(
        users.admin._id,
        item.config,
      );
    }

    const mariaFiles: Array<{ key: string; config: SeededFileConfig }> = [
      {
        key: 'maria_taller_propuesta',
        config: {
          name: 'propuesta-alfabetizacion-digital.md',
          type: FileType.Md,
          folderId: folders.maria_tall._id,
          tags: ['vinculacion', 'comunidad', 'talleres'],
          content: `# Proyecto: Alfabetización Digital en Comunidades Rurales

**Coordinadora General**: Lic. María López
**Área**: Extensión y Vinculación Universitaria

### Justificación
Brindar herramientas digitales básicas y conceptos de seguridad informática a jóvenes y docentes de escuelas rurales.

### Fases del Proyecto:
1. Diagnóstico de conectividad e infraestructura local.
2. Capacitación docente en recursos educativos abiertos.
3. Talleres prácticos sobre herramientas de ofimática y gestión documental.`,
        },
      },
      {
        key: 'maria_cronograma_talleres',
        config: {
          name: 'cronograma-talleres-2026.txt',
          type: FileType.Txt,
          folderId: folders.maria_tall._id,
          tags: ['cronograma', 'fechas', 'talleres'],
          content: `CRONOGRAMA DE ACTIVIDADES 2026 - TALLERES COMUNITARIOS
Taller 1: Alfabetización Digital Inicial - 12 de Noviembre
Taller 2: Gestión de Documentos y Seguridad - 26 de Noviembre
Taller 3: Cierre y Evaluación Comunitaria - 10 de Diciembre`,
        },
      },
      {
        key: 'maria_root_informe',
        config: {
          name: 'resumen-ejecutivo-vinculacion.md',
          type: FileType.Md,
          folderId: null,
          tags: ['informe', 'resumen', 'extension'],
          content: `# Resumen Ejecutivo de Vinculación Social 2026

Informe consolidado de metas alcanzadas e impacto en beneficiarios directos durante el primer trimestre del año.`,
        },
      },
    ];

    for (const item of mariaFiles) {
      files[item.key] = await this.createFileDocument(
        users.maria._id,
        item.config,
      );
    }

    const carlosFiles: Array<{ key: string; config: SeededFileConfig }> = [
      {
        key: 'carlos_paper_educacion',
        config: {
          name: 'articulo-transformacion-educativa.md',
          type: FileType.Md,
          folderId: folders.carlos_pub._id,
          tags: ['investigacion', 'articulo', 'paper'],
          content: `# Transformación Digital en Instituciones de Educación Superior

**Autor Principal**: Dr. Carlos Mendoza
**Estado**: En arbitraje por pares (Double-blind peer review)

### Resumen
Este trabajo analiza el impacto de la adopción de plataformas centralizadas de gestión de contenidos y colaboración sincrónica en el rendimiento académico y la eficiencia administrativa.`,
        },
      },
      {
        key: 'carlos_feedback_arbitraje',
        config: {
          name: 'observaciones-arbitraje-editorial.txt',
          type: FileType.Txt,
          folderId: folders.carlos_pub._id,
          tags: ['arbitraje', 'editorial', 'revision'],
          content: `OBSERVACIONES DEL COMITÉ EDITORIAL
- Profundizar en la muestra de datos recolectados en el capítulo 4.
- Incluir referencias a normativas internacionales sobre custodia documental.`,
        },
      },
    ];

    for (const item of carlosFiles) {
      files[item.key] = await this.createFileDocument(
        users.carlos._id,
        item.config,
      );
    }

    return files;
  }

  private async createFileDocument(
    ownerId: Types.ObjectId,
    config: SeededFileConfig,
  ): Promise<FileDocument> {
    const buffer = Buffer.from(config.content, 'utf-8');
    const gridFsId = await this.gridFsService.upload(config.name, buffer);

    const fileId = new Types.ObjectId();
    const deletedAt = config.isTrash
      ? new Date(Date.now() - 3600000 * 24 * 2)
      : null;
    const trashRootId = config.isTrash ? fileId : null;

    const fileDoc = await this.fileModel.create({
      _id: fileId,
      name: config.name,
      type: config.type,
      size: buffer.length,
      gridFsId,
      ownerId,
      folderId: config.folderId,
      tags: config.tags,
      deletedAt,
      trashRootId,
    });

    return fileDoc;
  }

  private async seedShares(
    users: Record<string, UserDocument>,
    folders: Record<string, FolderDocument>,
    files: Record<string, FileDocument>,
  ): Promise<void> {
    this.logger.log('Configurando recursos compartidos interdepartamentales...');

    const sharesData = [
      {
        resourceType: ShareResourceType.Folder,
        resourceId: folders.admin_pol._id,
        ownerId: users.admin._id,
        sharedWithId: users.edk._id,
        permission: SharePermission.Read,
      },
      {
        resourceType: ShareResourceType.File,
        resourceId: files.admin_manual_admin._id,
        ownerId: users.admin._id,
        sharedWithId: users.edk._id,
        permission: SharePermission.Comment,
      },
      {
        resourceType: ShareResourceType.File,
        resourceId: files.maria_taller_propuesta._id,
        ownerId: users.maria._id,
        sharedWithId: users.edk._id,
        permission: SharePermission.Edit,
      },
      {
        resourceType: ShareResourceType.File,
        resourceId: files.carlos_paper_educacion._id,
        ownerId: users.carlos._id,
        sharedWithId: users.edk._id,
        permission: SharePermission.Comment,
      },
      {
        resourceType: ShareResourceType.Folder,
        resourceId: folders.edk_arq._id,
        ownerId: users.edk._id,
        sharedWithId: users.maria._id,
        permission: SharePermission.Read,
      },
      {
        resourceType: ShareResourceType.File,
        resourceId: files.edk_arq_backend._id,
        ownerId: users.edk._id,
        sharedWithId: users.carlos._id,
        permission: SharePermission.Edit,
      },
      {
        resourceType: ShareResourceType.File,
        resourceId: files.edk_root_bienvenida._id,
        ownerId: users.edk._id,
        sharedWithId: users.user._id,
        permission: SharePermission.Read,
      },
    ];

    for (const share of sharesData) {
      await this.shareModel.create(share);
    }
  }

  private async seedActivities(
    users: Record<string, UserDocument>,
    folders: Record<string, FolderDocument>,
    files: Record<string, FileDocument>,
  ): Promise<void> {
    this.logger.log('Generando historial de auditoría y actividad reciente...');

    const activities = [
      {
        userId: users.edk._id,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: files.edk_arq_backend._id,
        resourceName: files.edk_arq_backend.name,
        details: { size: files.edk_arq_backend.size, type: 'md' },
      },
      {
        userId: users.edk._id,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: files.edk_ia_benchmark._id,
        resourceName: files.edk_ia_benchmark.name,
        details: { size: files.edk_ia_benchmark.size, type: 'md' },
      },
      {
        userId: users.edk._id,
        action: ActivityAction.Share,
        resourceType: ActivityResourceType.File,
        resourceId: files.edk_arq_backend._id,
        resourceName: files.edk_arq_backend.name,
        details: {
          sharedWith: users.carlos.username,
          permission: SharePermission.Edit,
        },
      },
      {
        userId: users.admin._id,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: files.admin_pol_gestion._id,
        resourceName: files.admin_pol_gestion.name,
        details: { size: files.admin_pol_gestion.size, type: 'md' },
      },
      {
        userId: users.admin._id,
        action: ActivityAction.Share,
        resourceType: ActivityResourceType.Folder,
        resourceId: folders.admin_pol._id,
        resourceName: folders.admin_pol.name,
        details: {
          sharedWith: users.edk.username,
          permission: SharePermission.Read,
        },
      },
      {
        userId: users.maria._id,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: files.maria_taller_propuesta._id,
        resourceName: files.maria_taller_propuesta.name,
        details: { size: files.maria_taller_propuesta.size, type: 'md' },
      },
      {
        userId: users.maria._id,
        action: ActivityAction.Share,
        resourceType: ActivityResourceType.File,
        resourceId: files.maria_taller_propuesta._id,
        resourceName: files.maria_taller_propuesta.name,
        details: {
          sharedWith: users.edk.username,
          permission: SharePermission.Edit,
        },
      },
      {
        userId: users.carlos._id,
        action: ActivityAction.Upload,
        resourceType: ActivityResourceType.File,
        resourceId: files.carlos_paper_educacion._id,
        resourceName: files.carlos_paper_educacion.name,
        details: { size: files.carlos_paper_educacion.size, type: 'md' },
      },
      {
        userId: users.edk._id,
        action: ActivityAction.Delete,
        resourceType: ActivityResourceType.File,
        resourceId: files.edk_trash_file._id,
        resourceName: files.edk_trash_file.name,
        details: { movedToTrash: true },
      },
    ];

    for (const act of activities) {
      await this.activityModel.create(act);
    }
  }

  private async updateUserStorageMetrics(
    users: Record<string, UserDocument>,
  ): Promise<void> {
    this.logger.log('Calculando métricas de almacenamiento por usuario...');

    for (const user of Object.values(users)) {
      const activeFiles = await this.fileModel.find({
        ownerId: user._id,
        deletedAt: null,
      });

      const totalBytes = activeFiles.reduce(
        (sum, file) => sum + (file.size || 0),
        0,
      );

      await this.userModel.findByIdAndUpdate(user._id, {
        storageUsedBytes: totalBytes,
      });

      this.logger.log(
        `Métricas de cuota actualizadas para ${user.username}: ${totalBytes} bytes en ${activeFiles.length} archivos activos.`,
      );
    }
  }
}
