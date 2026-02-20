import { IsEmail, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class CreateUserOAuthDto {
  @IsString()
  name: string;
  @IsString()
  @IsEmail()
  email: string;
  @IsString()
  @Length(2)
  password?: string;
  @IsOptional()
  @IsUrl()
  picture?: string;
}
