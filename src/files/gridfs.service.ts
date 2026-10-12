import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import type { Connection } from 'mongoose';

// servico para guardar los archivos
@Injectable()
export class GridFsService {
  private bucket: mongoose.mongo.GridFSBucket;

  constructor(@InjectConnection() conn: Connection) {
    this.bucket = new mongoose.mongo.GridFSBucket(conn.db!, { bucketName: 'contents' });
  }

  upload(filename: string, buffer: Buffer): Promise<Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const stream = this.bucket.openUploadStream(filename);
      stream.on('error', reject);
      stream.on('finish', () => resolve(stream.id as Types.ObjectId));
      stream.end(buffer);
    });
  }

  download(id: Types.ObjectId): mongoose.mongo.GridFSBucketReadStream {
    return this.bucket.openDownloadStream(id);
  }

  readToBuffer(id: Types.ObjectId): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = this.download(id);
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  delete(id: Types.ObjectId): Promise<void> {
    return this.bucket.delete(id);
  }
}
