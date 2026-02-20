import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsPhoneNumber,
} from 'class-validator';

export class SignUpDoctorDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  fullName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number' })
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Specialization must be at least 2 characters' })
  @MaxLength(200, { message: 'Specialization must not exceed 200 characters' })
  specialization: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'License number must be at least 3 characters' })
  @MaxLength(100, { message: 'License number must not exceed 100 characters' })
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      'License number can only contain uppercase letters, numbers, and hyphens',
  })
  licenseNumber: string;
}
