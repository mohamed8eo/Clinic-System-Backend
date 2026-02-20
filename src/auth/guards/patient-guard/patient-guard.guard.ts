import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class PatientGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).user;

    // Check if user exists at all
    if (!user) {
      throw new UnauthorizedException('You must be logged in');
    }

    // Check if user is a patient
    if (user.role === 'patient') {
      return true;
    }

    throw new ForbiddenException('Access denied. Patients only.');
  }
}
