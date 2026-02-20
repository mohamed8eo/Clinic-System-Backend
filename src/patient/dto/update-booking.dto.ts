import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateBookingDto {
  @IsDateString()
  @IsOptional()
  appointmentDate?: string;

  @IsString()
  @IsOptional()
  appointmentTime?: string;

  @IsString()
  @IsOptional()
  reasonForVisit?: string;
}
