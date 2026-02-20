import { Inject, Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt-config';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '../types/jwtPayload';
@Injectable()
export class jwtAccessToken_Strategy extends PassportStrategy(
  Strategy,
  'accessToken',) {
  constructor(
    @Inject(jwtConfig.KEY)
    private jwtconfiguration: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtconfiguration.secret as string,
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };
  }
}
