import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema.js';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from '../dto/auth.dto.js';
import bcrypt from 'bcrypt'

@Injectable()
export class AuthService {

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const existsEmail = await this.userModel.exists({ email: dto.email })
        const existsUsername = await this.userModel.exists({ username: dto.username })
        if (existsEmail || existsUsername) throw new ConflictException('El correo o el username ya esta registrado')

        const passwordHash = await bcrypt.hash(dto.password, 10)

        const user = await this.userModel.create({
            username: dto.username,
            email: dto.email,
            password: passwordHash,
        });
        return this.buildToken(user)
    }

    async login(dto: LoginDto) {

        const user = await this.userModel
            .findOne({
                $or: [
                    { username: dto.user },
                    { email: dto.user },
                ],
            })
            .select('+password');

        if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');

        const ok = await bcrypt.compare(dto.password, user.password);

        if (!ok) throw new UnauthorizedException('Credenciales inválidas');

        return this.buildToken(user);
    }

    // metodo para construir el token
    private buildToken(user: UserDocument) {
        const payload = { sub: user._id.toString(), username: user.username, email: user.email, role: user.role };
        
        return { access_token: this.jwtService.sign(payload) };
    }
}
