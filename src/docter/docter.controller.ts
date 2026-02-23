import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { DocterService } from './docter.service';
import { CurrentUser } from 'src/auth/decorator/CurrentUser.decorator';
import type { UserFromJwt } from 'src/auth/types/UserFromJwt';
import { DoctorGuard } from 'src/auth/guards/doctor-guard/doctor-guard.guard';

@UseGuards(DoctorGuard)
@Controller('doctor')
export class DocterController {
  constructor(private readonly docterService: DocterService) {}

  // ============================================
  // PROFILE ENDPOINTS
  // ============================================

  // GET /doctor/profile
  @Get('profile')
  async getProfile(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getProfile(user.userId);
  }

  // PATCH /doctor/profile
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: UserFromJwt,
    @Body() body: {
      fullName?: string;
      phone?: string;
      gender?: string;
      dateOfBirth?: string;
      address?: string;
      specialization?: string;
    },
  ) {
    return await this.docterService.updateProfile(user.userId, body);
  }

  // ============================================
  // DASHBOARD STATS
  // GET /doctor/dashboard
  // ============================================
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getDashboardStats(user.userId);
  }

  // ============================================
  // CALENDAR ENDPOINTS
  // ============================================

  // GET /doctor/appointments/today
  @Get('appointments/today')
  async getTodayAppointments(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getTodayAppointments(user.userId);
  }

  // GET /doctor/appointments/week
  @Get('appointments/week')
  async getWeekAppointments(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getWeekAppointments(user.userId);
  }

  // GET /doctor/appointments/month
  @Get('appointments/month')
  async getMonthAppointments(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getMonthAppointments(user.userId);
  }

  // GET /doctor/slots?date=2026-02-20
  @Get('slots')
  async getAvailableSlots(
    @CurrentUser() user: UserFromJwt,
    @Query('date') date: string,
  ) {
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }
    return await this.docterService.getAvailableSlots(user.userId, date);
  }

  // ============================================
  // BLOCK TIME ENDPOINTS
  // ============================================

  // POST /doctor/block-time
  @Post('block-time')
  async blockTime(
    @CurrentUser() user: UserFromJwt,
    @Body(ValidationPipe)
    dto: {
      date: string;
      startTime?: string;
      endTime?: string;
      isFullDay: boolean;
      reason?: string;
    },
  ) {
    return await this.docterService.blockTime(user.userId, dto);
  }

  // DELETE /doctor/block-time/:id
  @Delete('block-time/:id')
  async unblockTime(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.docterService.unblockTime(user.userId, id);
  }

  // GET /doctor/block-time
  @Get('block-time')
  async getBlockedTimes(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getBlockedTimes(user.userId);
  }

  // ============================================
  // REPORT ENDPOINTS
  // GET /doctor/report?period=day|week|month|year
  // ============================================
  @Get('report')
  async getReport(
    @CurrentUser() user: UserFromJwt,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'day',
  ) {
    return await this.docterService.getReport(user.userId, period);
  }

  // ============================================
  // PATIENTS ENDPOINTS
  // ============================================

  // GET /doctor/patients
  @Get('patients')
  async getPatients(@CurrentUser() user: UserFromJwt) {
    return await this.docterService.getPatients(user.userId);
  }

  // GET /doctor/patients/:id/history
  @Get('patients/:id/history')
  async getPatientHistory(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) patientId: number,
  ) {
    return await this.docterService.getPatientHistory(user.userId, patientId);
  }

  // ============================================
  // APPOINTMENT MANAGEMENT
  // ============================================

  // PATCH /doctor/appointments/:id/status
  @Patch('appointments/:id/status')
  async updateAppointmentStatus(
    @CurrentUser() user: UserFromJwt,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; notes?: string },
  ) {
    return await this.docterService.updateAppointmentStatus(
      user.userId,
      id,
      body.status,
      body.notes,
    );
  }
}
