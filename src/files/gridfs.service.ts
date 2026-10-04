import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';

@Injectable()
export class GridFsService {

  private bucket: mongo.GridFSBucket;

  constructor(@InjectConnection() conn: Connection) {
    this.bucket = new mongo.GridFSBucket(conn.db!, { bucketName: 'contents' });
  }

  upload(filename: string, buffer: Buffer): Promise<Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const stream = this.bucket.openUploadStream(filename);
      stream.on('error', reject);
      stream.on('finish', () => resolve(stream.id as Types.ObjectId));
      stream.end(buffer);
    });
  }

  download(id: Types.ObjectId): mongo.GridFSBucketReadStream {
    return this.bucket.openDownloadStream(id);
  }

  delete(id: Types.ObjectId): Promise<void> {
    return this.bucket.delete(id);
  }
}
