import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule } from '@nestjs/config';
import jwtConfig from './config/jwt-config';
import RefreshTokenConfig from './config/RefreshToken-config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtAccessToken_Strategy } from './strategies/jwt-strategy';
import { JwtRefreshToken_Strategy } from './strategies/refreshToken-strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessAuthGuard } from './guards/jwt-access-auth/jwt-access-auth.guard';
import { DatabaseModule } from '../database/database.module';
import { GoogleStrategy } from './strategies/googleAuth.strategy';
import googleAuthConfig from './config/googleAuth.config';
import githubAuthConfig from './config/githubAuth.config';
import { GithubStrategy } from './strategies/githubAuth.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(RefreshTokenConfig),
    ConfigModule.forFeature(googleAuthConfig),
    ConfigModule.forFeature(githubAuthConfig),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    jwtAccessToken_Strategy,
    JwtRefreshToken_Strategy,
    GoogleStrategy,
    GithubStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAccessAuthGuard,
    },
  ],
})
export class AuthModule {}
