import { registerAs } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';

export default registerAs(
  'refresh_token',
  (): JwtSignOptions => ({
    secret: process.env.JWT_REFRESHTOKEN_SECRET,
    expiresIn: Number(process.env.JWT_REFRESH_EXPIRESIN),
  }),
);
