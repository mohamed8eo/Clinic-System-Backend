import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorator/Public.decorator';
import type { Request, Response } from 'express';
import { GoogleAuthGuard } from './guards/google_auth/google_auth.guard';
import { GithubAuthGuard } from './guards/github_auth/github_auth.guard';
import { SignUpPatientDto } from './dto/SignUpPatients.dto';
import { SignUpDoctorDto } from './dto/SignUpDocter.dto';
import { LogInDto } from './dto/LogIn.dto';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth/jwt-refresh-auth.guard';
import { CurrentUser } from './decorator/CurrentUser.decorator';
import type { UserFromJwt } from './types/UserFromJwt';
import { AfterSocailSign } from './dto/AfterUserSignwithSocail.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/login')
  async googleLogin() {
    // Initiates Google OAuth flow
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException('Google authentication failed');
    }

    const token = await this.authService.logInOAuthUser(user);

    const frontendUrl = this.configService.get<string>(
      'FRONT_END_CALLBACK_URL',
    );
    // Fixed: redirected -> redirect, and proper parentheses
    res.redirect(`${frontendUrl}?token=${token.accessToken}&refreshToken=${token.refreshToken}`);
  }

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github/login')
  async githubLogin() {}

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(' Github authentication failed');
    }
    const token = await this.authService.logInOAuthUser(user);
    const frontendUrl = this.configService.get<string>(
      'FRONT_END_CALLBACK_URL',
    );
    res.redirect(`${frontendUrl}?token=${token.accessToken}&refreshToken=${token.refreshToken}`);
  }

  //if user sign with socail provider it will redirect to next page that will take this data from it
  //phone, data of birthday , gender, address
  @Post('socailProvider/moreInfo')
  async patientInfo(
    @Body() dto: AfterSocailSign,
    @CurrentUser() user: UserFromJwt,
  ) {
    return await this.authService.completeSocialProfile(dto, user.userId);
  }

  @Public()
  @Post('sign-up/patient')
  async singUpPatient(@Body() dto: SignUpPatientDto) {
    return await this.authService.signUpPatient(dto);
  }

  @Public()
  @Post('sign-up/docter')
  async singUpDocter(@Body() dto: SignUpDoctorDto) {
    return await this.authService.signUpDoctor(dto);
  }

  @Public()
  @Post('login')
  async logIn(@Body() dto: LogInDto) {
    return await this.authService.logIn(dto);
  }

  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  async refreshToken(@CurrentUser() user: UserFromJwt) {
    return await this.authService.refreshAccessToken(
      user.userId,
      user.refreshToken,
    );
  }
}
