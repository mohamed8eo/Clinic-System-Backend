import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleAuthConfig from '../config/googleAuth.config';
import type { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleAuthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleAuthConfig>,
    private authService: AuthService,
  ) {
    super({
      clientID: googleConfiguration.clientID!,
      clientSecret: googleConfiguration.clientSecret!,
      callbackURL: googleConfiguration.callBackURL!,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { name, emails, photos } = profile;
    const firstName = name?.givenName ?? '';
    const lastName = name?.familyName ?? '';
    const email = emails?.[0]?.value;
    const picture = photos?.[0].value ?? '';
    if (!email) {
      throw new Error('Email not provided by Google');
    }

    const result = await this.authService.validateGoogleUser({
      name: `${firstName} ${lastName}`.trim(),
      email,
      picture,
      password: '',
    });

    done(null, result);
  }
}
