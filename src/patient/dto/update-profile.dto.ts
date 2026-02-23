import {
  IsString,
  IsOptional,
  IsPhoneNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number' })
  @IsOptional()
  phone?: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(Gender, { message: 'Gender must be either male, female, or other' })
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;
}
