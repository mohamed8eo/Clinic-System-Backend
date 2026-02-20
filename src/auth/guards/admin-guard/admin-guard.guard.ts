import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly allowedRoles = ['admin', 'doctor'];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user exists at all
    if (!user) {
      throw new UnauthorizedException('You must be logged in');
    }

    // Check if role is allowed
    if (!this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${this.allowedRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
