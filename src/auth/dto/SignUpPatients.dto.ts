import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsOptional,
  IsDateString,
  IsPhoneNumber,
} from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class SignUpPatientDto {
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

  @IsEnum(Gender, { message: 'Gender must be either male, female, or other' })
  @IsNotEmpty()
  gender: Gender;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address?: string;

  @IsDateString(
    {},
    { message: 'Date of birth must be a valid date in format YYYY-MM-DD' },
  )
  @IsNotEmpty()
  dateOfBirth: string;
}
