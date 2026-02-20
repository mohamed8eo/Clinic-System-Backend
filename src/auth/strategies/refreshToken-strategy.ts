import { Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import RefreshTokenConfig from '../config/RefreshToken-config';
import type { ConfigType } from '@nestjs/config';
import { JwtPayload } from '../types/jwtPayload';
import { Request } from 'express';
import { UserFromJwt } from '../types/UserFromJwt';

export class JwtRefreshToken_Strategy extends PassportStrategy(
  Strategy,
  'refreshToken',
) {
  constructor(
    @Inject(RefreshTokenConfig.KEY)
    private RefreshToken: ConfigType<typeof RefreshTokenConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: RefreshToken.secret as string,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }
  validate(req: Request, payload: JwtPayload): UserFromJwt {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
      throw new Error('Refresh token not found');
    }
    const refreshToken = authHeader.replace('Bearer', '').trim();
    return {
      userId: parseInt(payload.sub, 10),
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      refreshToken,
    };
  }
}
