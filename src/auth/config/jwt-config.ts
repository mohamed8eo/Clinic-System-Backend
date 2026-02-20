import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
export default registerAs(
  'jwt-accessToken',
  (): JwtModuleOptions => ({
    secret: process.env.JWT_ACESSTOKEN_SECRET,
    signOptions: {
      expiresIn: Number(process.env.JWT_ACESS_EXPIRESIN),
    },
  }),
);
