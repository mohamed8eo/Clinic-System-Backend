import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class AfterSocailSign {
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
