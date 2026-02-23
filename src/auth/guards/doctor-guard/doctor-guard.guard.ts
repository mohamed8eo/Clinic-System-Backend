import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class DoctorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).user;

    if (!user) {
      throw new UnauthorizedException('You must be logged in');
    }

    if (user.role === 'doctor') {
      return true;
    }

    throw new ForbiddenException('Access denied. Doctors only.');
  }
}
