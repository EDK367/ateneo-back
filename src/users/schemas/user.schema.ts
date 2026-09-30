import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum Role { Admin = 'admin', User = 'user' }

@Schema({ timestamps: true })
export class User {

    @Prop({ required: true, unique: true, trim: true })
    username: string;

    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Prop({ required: true, select: false })
    password: string;

    @Prop({ type: String, enum: Role, default: Role.User })
    role: Role;

    @Prop({ default: true })
    isActive: boolean;

    // reportes
    @Prop({ default: 0 })
    storageUsedBytes: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
