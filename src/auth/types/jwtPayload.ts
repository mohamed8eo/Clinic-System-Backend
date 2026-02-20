export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: string;
  type: 'access' | 'refresh';
}
