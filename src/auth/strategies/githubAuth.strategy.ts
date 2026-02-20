import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { VerifyCallback } from 'passport-google-oauth20';
import githubAuthConfig from '../config/githubAuth.config';
import type { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(githubAuthConfig.KEY)
    private githubConfiguration: ConfigType<typeof githubAuthConfig>,
    private authService: AuthService,
  ) {
    super({
      clientID: githubConfiguration.clientID!,
      clientSecret: githubConfiguration.clientSecret!,
      callbackURL: githubConfiguration.callBackURL!,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const name = profile.displayName || profile.username || '';
    const email = profile.emails?.[0]?.value;
    const picture = profile.photos?.[0]?.value;
    if (!email) {
      throw new Error('Email not provided by GitHub');
    }

    const user = await this.authService.validateGithubUser({
      name,
      email,
      picture,
      password: '',
    });

    done(null, user);
  }
}
