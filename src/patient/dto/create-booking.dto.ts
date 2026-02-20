import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  doctorId: number;

  @IsDateString()
  @IsNotEmpty()
  appointmentDate: string;

  @IsString()
  @IsNotEmpty()
  appointmentTime: string; // Format: "09:00"

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reasonForVisit?: string;
}
