import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CurrentUser } from 'src/auth/decorator/CurrentUser.decorator';
import type { UserFromJwt } from 'src/auth/types/UserFromJwt';
import { PatientGuard } from 'src/auth/guards/patient-guard/patient-guard.guard';

@UseGuards(PatientGuard)
@Controller('patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get('specializations')
  async getAllSpecializations() {
    return await this.patientService.getAllSpecializations();
  }

  @Get('doctors')
  async getDoctorsBySpecialization(
    @Query('specialization') specialization: string,
  ) {
    return await this.patientService.getDoctorsBySpecialization(specialization);
  }

  @Get('doctors/:doctorId/slots')
  async getDoctorFreeSlots(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Query('date') date: string,
  ) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    return await this.patientService.getDoctorFreeSlots(doctorId, date);
  }

  @Get('bookings')
  async getAllBookings(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getAllBookings(user.userId);
  }

  @Get('bookings/:id')
  async getBookingById(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.patientService.getBookingById(user.userId, id);
  }

  @Post('bookings')
  async createBooking(
    @CurrentUser() user: UserFromJwt,
    @Body(ValidationPipe) dto: CreateBookingDto,
  ) {
    return await this.patientService.createBooking(user.userId, dto);
  }

  @Patch('bookings/:id')
  async updateBooking(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateBookingDto,
  ) {
    return await this.patientService.updateBooking(user.userId, id, dto);
  }

  @Delete('bookings/:id')
  async deleteBooking(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.patientService.deleteBooking(user.userId, id);
  }
}
//
//
// ## **4. All Endpoints Summary**
// GET  /patient/specializations              → All specializations with doctor count
// GET  /patient/doctors?specialization=X    → Doctors by specialization
// GET  /patient/doctors/:id/slots?date=X    → Free time slots for a doctor
// GET  /patient/bookings                    → All patient bookings (upcoming + past)
// GET  /patient/bookings/:id               → Single booking details
// POST /patient/bookings                    → Create new booking
// PATCH /patient/bookings/:id              → Update booking (2h restriction)
// DELETE /patient/bookings/:id             → Cancel booking (2h restriction)
