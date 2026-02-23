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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../auth/decorator/CurrentUser.decorator';
import type { UserFromJwt } from '../auth/types/UserFromJwt';
import { PatientGuard } from '../auth/guards/patient-guard/patient-guard.guard';

@UseGuards(PatientGuard)
@Controller('patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // ============================================
  // PROFILE ENDPOINTS
  // ============================================

  // GET /patient/profile - Get basic profile info
  @Get('profile')
  async getProfile(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getProfile(user.userId);
  }

  // GET /patient/info - Get complete info (profile + statistics)
  @Get('info')
  async getCompleteInfo(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getCompletePatientInfo(user.userId);
  }

  // GET /patient/statistics - Get appointment statistics
  @Get('statistics')
  async getStatistics(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getPatientStats(user.userId);
  }

  // GET /patient/medical-history - Get medical history with notes
  @Get('medical-history')
  async getMedicalHistory(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getMedicalHistorySummary(user.userId);
  }

  // PATCH /patient/profile - Update profile information
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: UserFromJwt,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ) {
    return await this.patientService.updateProfile(user.userId, dto);
  }

  // PATCH /patient/profile-picture - Update profile picture
  @Patch('profile-picture')
  async updateProfilePicture(
    @CurrentUser() user: UserFromJwt,
    @Body('imageUrl') imageUrl: string,
  ) {
    return await this.patientService.updateProfilePicture(
      user.userId,
      imageUrl,
    );
  }

  // DELETE /patient/profile-picture - Remove profile picture
  @Delete('profile-picture')
  async deleteProfilePicture(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.deleteProfilePicture(user.userId);
  }

  // ============================================
  // SPECIALIZATIONS & DOCTORS ENDPOINTS
  // ============================================

  // GET /patient/specializations - Get all specializations with doctor count
  @Get('specializations')
  async getAllSpecializations() {
    return await this.patientService.getAllSpecializations();
  }

  // GET /patient/doctors?specialization=Cardiology - Get doctors by specialization
  @Get('doctors')
  async getDoctorsBySpecialization(
    @Query('specialization') specialization: string,
  ) {
    return await this.patientService.getDoctorsBySpecialization(specialization);
  }

  // GET /patient/doctors/:doctorId/slots?date=2026-02-20 - Get free time slots
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

  // ============================================
  // BOOKING ENDPOINTS
  // ============================================

  // GET /patient/bookings - Get all bookings (upcoming + past)
  @Get('bookings')
  async getAllBookings(@CurrentUser() user: UserFromJwt) {
    return await this.patientService.getAllBookings(user.userId);
  }

  // GET /patient/bookings/:id - Get single booking details
  @Get('bookings/:id')
  async getBookingById(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.patientService.getBookingById(user.userId, id);
  }

  // POST /patient/bookings - Create new booking
  @Post('bookings')
  async createBooking(
    @CurrentUser() user: UserFromJwt,
    @Body(ValidationPipe) dto: CreateBookingDto,
  ) {
    return await this.patientService.createBooking(user.userId, dto);
  }

  // PATCH /patient/bookings/:id - Update booking (2h restriction)
  @Patch('bookings/:id')
  async updateBooking(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateBookingDto,
  ) {
    return await this.patientService.updateBooking(user.userId, id, dto);
  }

  // DELETE /patient/bookings/:id - Cancel booking (2h restriction)
  @Delete('bookings/:id')
  async deleteBooking(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.patientService.deleteBooking(user.userId, id);
  }
}
