import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DocterService {
  constructor(private db: DatabaseService) {}

  // ============================================
  // GET ALL PATIENTS BOOKING FOR TODAY
  // ============================================
  async getTodayAppointments(doctorId: number) {
    const appointments = await this.db.query(
      `SELECT 
        a.id,
        a.appointment_code,
        a.appointment_date,
        a.appointment_time,
        a.status,
        a.reason_for_visit,
        a.notes,
        p.id as patient_id,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone,
        p.gender as patient_gender,
        p.date_of_birth as patient_date_of_birth,
        p.address as patient_address
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = $1
      AND a.appointment_date = CURRENT_DATE
      AND a.status != 'cancelled'
      ORDER BY a.appointment_time ASC`,
      [doctorId],
    );

    return {
      date: new Date().toISOString().split('T')[0],
      totalCount: appointments.length,
      appointments: appointments.map((apt) => this.formatAppointment(apt)),
    };
  }

  // ============================================
  // GET ALL PATIENTS BOOKING FOR THIS WEEK
  // ============================================
  async getWeekAppointments(doctorId: number) {
    const appointments = await this.db.query(
      `SELECT 
        a.id,
        a.appointment_code,
        a.appointment_date,
        a.appointment_time,
        a.status,
        a.reason_for_visit,
        a.notes,
        p.id as patient_id,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone,
        p.gender as patient_gender,
        p.date_of_birth as patient_date_of_birth,
        p.address as patient_address
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = $1
      AND a.appointment_date >= DATE_TRUNC('week', CURRENT_DATE)
      AND a.appointment_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
      AND a.status != 'cancelled'
      ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
      [doctorId],
    );

    // Group appointments by day
    const grouped = this.groupAppointmentsByDay(appointments);

    return {
      weekStart: this.getWeekStart(),
      weekEnd: this.getWeekEnd(),
      totalCount: appointments.length,
      days: grouped,
    };
  }

  // ============================================
  // GET ALL PATIENTS BOOKING FOR THIS MONTH
  // ============================================
  async getMonthAppointments(doctorId: number) {
    const appointments = await this.db.query(
      `SELECT 
        a.id,
        a.appointment_code,
        a.appointment_date,
        a.appointment_time,
        a.status,
        a.reason_for_visit,
        a.notes,
        p.id as patient_id,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = $1
      AND DATE_TRUNC('month', a.appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
      AND a.status != 'cancelled'
      ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
      [doctorId],
    );

    const grouped = this.groupAppointmentsByDay(appointments);

    return {
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear(),
      totalCount: appointments.length,
      days: grouped,
    };
  }

  // ============================================
  // GET AVAILABLE TIME SLOTS FOR A DAY
  // ============================================
  async getAvailableSlots(doctorId: number, date: string) {
    // Get booked slots
    const bookedSlots = await this.db.query(
      `SELECT appointment_time 
       FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2
       AND status NOT IN ('cancelled')`,
      [doctorId, date],
    );

    // Get blocked times for this day
    const blockedTimes = await this.db.query(
      `SELECT start_time, end_time, is_full_day
       FROM blocked_times
       WHERE doctor_id = $1 
       AND blocked_date = $2`,
      [doctorId, date],
    );

    // Check if entire day is blocked
    const isDayBlocked = blockedTimes.some((bt) => bt.is_full_day);
    if (isDayBlocked) {
      return {
        date,
        available: false,
        message: 'This day is fully blocked',
        slots: [],
      };
    }

    // Generate all time slots (9 AM - 5 PM, 30 min intervals)
    const allSlots = this.generateTimeSlots('09:00', '17:00', 30);

    // Filter out booked and blocked slots
    const bookedTimes = bookedSlots.map((b) =>
      b.appointment_time.substring(0, 5),
    );

    const availableSlots = allSlots.filter((slot) => {
      // Check if slot is booked
      if (bookedTimes.includes(slot)) return false;

      // Check if slot is in a blocked range
      const isBlocked = blockedTimes.some((bt) => {
        if (!bt.start_time || !bt.end_time) return false;
        return slot >= bt.start_time.substring(0, 5) &&
          slot < bt.end_time.substring(0, 5);
      });

      return !isBlocked;
    });

    return {
      date,
      available: true,
      totalSlots: allSlots.length,
      availableCount: availableSlots.length,
      bookedCount: bookedTimes.length,
      slots: availableSlots.map((time) => ({
        time,
        display: this.formatTime(time),
        isAvailable: true,
      })),
    };
  }

  // ============================================
  // BLOCK TIME SLOTS
  // ============================================
  async blockTime(
    doctorId: number,
    dto: {
      date: string;
      startTime?: string;
      endTime?: string;
      isFullDay: boolean;
      reason?: string;
    },
  ) {
    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (dto.date < today) {
      throw new BadRequestException('Cannot block past dates');
    }

    // Validate times if not full day
    if (!dto.isFullDay) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'Start time and end time are required when not blocking full day',
        );
      }
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('Start time must be before end time');
      }
    }

    // Check if already blocked
    const existingBlock = await this.db.queryOne(
      `SELECT id FROM blocked_times 
       WHERE doctor_id = $1 
       AND blocked_date = $2
       AND (is_full_day = true 
            OR (start_time = $3 AND end_time = $4))`,
      [doctorId, dto.date, dto.startTime, dto.endTime],
    );

    if (existingBlock) {
      throw new BadRequestException('This time is already blocked');
    }

    // Check if there are appointments in this time slot
    if (!dto.isFullDay) {
      const conflictingAppointments = await this.db.query(
        `SELECT COUNT(*) as count
         FROM appointments
         WHERE doctor_id = $1
         AND appointment_date = $2
         AND appointment_time >= $3
         AND appointment_time < $4
         AND status NOT IN ('cancelled')`,
        [doctorId, dto.date, dto.startTime, dto.endTime],
      );

      if (parseInt(conflictingAppointments[0].count) > 0) {
        throw new BadRequestException(
          'There are existing appointments in this time slot. Please reschedule them first.',
        );
      }
    }

    // Insert blocked time
    const blocked = await this.db.queryOne(
      `INSERT INTO blocked_times (
        doctor_id, blocked_date, start_time, 
        end_time, is_full_day, reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [
        doctorId,
        dto.date,
        dto.isFullDay ? null : dto.startTime,
        dto.isFullDay ? null : dto.endTime,
        dto.isFullDay,
        dto.reason || null,
      ],
    );

    return {
      success: true,
      message: dto.isFullDay
        ? `Full day blocked for ${dto.date}`
        : `Time ${dto.startTime} - ${dto.endTime} blocked for ${dto.date}`,
      blockedTime: blocked,
    };
  }

  // ============================================
  // UNBLOCK TIME SLOTS
  // ============================================
  async unblockTime(doctorId: number, blockId: number) {
    const block = await this.db.queryOne(
      'SELECT * FROM blocked_times WHERE id = $1 AND doctor_id = $2',
      [blockId, doctorId],
    );

    if (!block) {
      throw new NotFoundException('Blocked time not found');
    }

    await this.db.execute(
      'DELETE FROM blocked_times WHERE id = $1 AND doctor_id = $2',
      [blockId, doctorId],
    );

    return {
      success: true,
      message: 'Time unblocked successfully',
    };
  }

  // ============================================
  // GET ALL BLOCKED TIMES
  // ============================================
  async getBlockedTimes(doctorId: number) {
    const blockedTimes = await this.db.query(
      `SELECT * FROM blocked_times 
       WHERE doctor_id = $1 
       AND blocked_date >= CURRENT_DATE
       ORDER BY blocked_date ASC, start_time ASC`,
      [doctorId],
    );

    return {
      totalCount: blockedTimes.length,
      blockedTimes,
    };
  }

  // ============================================
  // GET REPORTS
  // ============================================
  async getReport(doctorId: number, period: 'day' | 'week' | 'month' | 'year') {
    const dateFilter = this.getDateFilter(period);

    // Main stats
    const stats = await this.db.queryOne(
      `SELECT
        COUNT(*) as total_appointments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'booked') as booked,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
        COUNT(DISTINCT patient_id) as unique_patients
       FROM appointments
       WHERE doctor_id = $1
       AND ${dateFilter.filter}`,
      [doctorId, ...dateFilter.params],
    );

    // Daily breakdown
    const dailyBreakdown = await this.db.query(
      `SELECT 
        appointment_date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM appointments
       WHERE doctor_id = $1
       AND ${dateFilter.filter}
       GROUP BY appointment_date
       ORDER BY appointment_date ASC`,
      [doctorId, ...dateFilter.params],
    );

    // Most common reasons for visit
    const topReasons = await this.db.query(
      `SELECT 
        reason_for_visit,
        COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1
       AND ${dateFilter.filter}
       AND reason_for_visit IS NOT NULL
       GROUP BY reason_for_visit
       ORDER BY count DESC
       LIMIT 5`,
      [doctorId, ...dateFilter.params],
    );

    // Busiest time slots
    const busiestSlots = await this.db.query(
      `SELECT 
        appointment_time,
        COUNT(*) as count
       FROM appointments
       WHERE doctor_id = $1
       AND ${dateFilter.filter}
       GROUP BY appointment_time
       ORDER BY count DESC
       LIMIT 5`,
      [doctorId, ...dateFilter.params],
    );

    return {
      period,
      dateRange: {
        from: dateFilter.from,
        to: dateFilter.to,
      },
      stats: {
        totalAppointments: parseInt(stats.total_appointments),
        completed: parseInt(stats.completed),
        cancelled: parseInt(stats.cancelled),
        booked: parseInt(stats.booked),
        confirmed: parseInt(stats.confirmed),
        noShow: parseInt(stats.no_show),
        uniquePatients: parseInt(stats.unique_patients),
        completionRate:
          stats.total_appointments > 0
            ? Math.round(
                (parseInt(stats.completed) /
                  parseInt(stats.total_appointments)) *
                  100,
              )
            : 0,
        cancellationRate:
          stats.total_appointments > 0
            ? Math.round(
                (parseInt(stats.cancelled) /
                  parseInt(stats.total_appointments)) *
                  100,
              )
            : 0,
      },
      dailyBreakdown: dailyBreakdown.map((day) => ({
        date: day.appointment_date,
        total: parseInt(day.total),
        completed: parseInt(day.completed),
        cancelled: parseInt(day.cancelled),
      })),
      topReasons: topReasons.map((r) => ({
        reason: r.reason_for_visit,
        count: parseInt(r.count),
      })),
      busiestSlots: busiestSlots.map((s) => ({
        time: this.formatTime(s.appointment_time.substring(0, 5)),
        count: parseInt(s.count),
      })),
    };
  }

  // ============================================
  // UPDATE APPOINTMENT STATUS
  // ============================================
  async updateAppointmentStatus(
    doctorId: number,
    appointmentId: number,
    status: string,
    notes?: string,
  ) {
    const appointment = await this.db.queryOne(
      'SELECT * FROM appointments WHERE id = $1 AND doctor_id = $2',
      [appointmentId, doctorId],
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const updated = await this.db.queryOne(
      `UPDATE appointments 
       SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND doctor_id = $4
       RETURNING *`,
      [status, notes || null, appointmentId, doctorId],
    );

    return {
      success: true,
      message: `Appointment status updated to ${status}`,
      appointment: updated,
    };
  }

  // ============================================
  // GET DASHBOARD STATS
  // ============================================
  async getDashboardStats(doctorId: number) {
    const stats = await this.db.queryOne(
      `SELECT
        COUNT(*) FILTER (
          WHERE appointment_date = CURRENT_DATE
          AND status != 'cancelled'
        ) as today_total,
        COUNT(*) FILTER (
          WHERE appointment_date = CURRENT_DATE 
          AND status = 'completed'
        ) as today_completed,
        COUNT(*) FILTER (
          WHERE appointment_date = CURRENT_DATE 
          AND status = 'booked'
        ) as today_remaining,
        COUNT(*) FILTER (
          WHERE appointment_date >= DATE_TRUNC('week', CURRENT_DATE)
          AND appointment_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
          AND status != 'cancelled'
        ) as week_total,
        COUNT(*) FILTER (
          WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
          AND status != 'cancelled'
        ) as month_total,
        COUNT(DISTINCT patient_id) as total_patients
       FROM appointments
       WHERE doctor_id = $1`,
      [doctorId],
    );

    // Next appointment today
    const nextAppointment = await this.db.queryOne(
      `SELECT 
        a.appointment_time,
        a.appointment_code,
        p.full_name as patient_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = $1
       AND a.appointment_date = CURRENT_DATE
       AND a.appointment_time > CURRENT_TIME
       AND a.status = 'booked'
       ORDER BY a.appointment_time ASC
       LIMIT 1`,
      [doctorId],
    );

    return {
      today: {
        total: parseInt(stats.today_total),
        completed: parseInt(stats.today_completed),
        remaining: parseInt(stats.today_remaining),
      },
      week: {
        total: parseInt(stats.week_total),
      },
      month: {
        total: parseInt(stats.month_total),
      },
      totalPatients: parseInt(stats.total_patients),
      nextAppointment: nextAppointment
        ? {
            time: this.formatTime(
              nextAppointment.appointment_time.substring(0, 5),
            ),
            patientName: nextAppointment.patient_name,
            code: nextAppointment.appointment_code,
          }
        : null,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private formatAppointment(apt: any) {
    return {
      id: apt.id,
      code: apt.appointment_code,
      date: apt.appointment_date,
      time: this.formatTime(apt.appointment_time?.substring(0, 5)),
      rawTime: apt.appointment_time,
      status: apt.status,
      reasonForVisit: apt.reason_for_visit,
      notes: apt.notes,
      patient: {
        id: apt.patient_id,
        name: apt.patient_name,
        email: apt.patient_email,
        phone: apt.patient_phone,
        gender: apt.patient_gender,
        dateOfBirth: apt.patient_date_of_birth,
        address: apt.patient_address,
      },
    };
  }

  private groupAppointmentsByDay(appointments: any[]) {
    const grouped: Record<string, any> = {};

    appointments.forEach((apt) => {
      const date = apt.appointment_date.toISOString().split('T')[0];

      if (!grouped[date]) {
        grouped[date] = {
          date,
          dayName: new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
          }),
          appointments: [],
          count: 0,
        };
      }

      grouped[date].appointments.push(this.formatAppointment(apt));
      grouped[date].count++;
    });

    return Object.values(grouped);
  }

  private generateTimeSlots(
    start: string,
    end: string,
    intervalMinutes: number,
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      slots.push(
        `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`,
      );

      currentMin += intervalMinutes;
      if (currentMin >= 60) {
        currentHour++;
        currentMin -= 60;
      }
    }

    return slots;
  }

  private formatTime(time: string): string {
    if (!time) return '';
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  }

  private getWeekStart(): string {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
  }

  private getWeekEnd(): string {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + 6;
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
  }

  private getDateFilter(period: string): {
    filter: string;
    params: any[];
    from: string;
    to: string;
  } {
    const today = new Date().toISOString().split('T')[0];

    switch (period) {
      case 'day':
        return {
          filter: 'appointment_date = $2',
          params: [today],
          from: today,
          to: today,
        };
      case 'week':
        return {
          filter: `appointment_date >= DATE_TRUNC('week', CURRENT_DATE)
                   AND appointment_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'`,
          params: [],
          from: this.getWeekStart(),
          to: this.getWeekEnd(),
        };
      case 'month':
        return {
          filter: `DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)`,
          params: [],
          from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .split('T')[0],
          to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            .toISOString()
            .split('T')[0],
        };
      case 'year':
        return {
          filter: `DATE_TRUNC('year', appointment_date) = DATE_TRUNC('year', CURRENT_DATE)`,
          params: [],
          from: `${new Date().getFullYear()}-01-01`,
          to: `${new Date().getFullYear()}-12-31`,
        };
      default:
        return {
          filter: 'appointment_date = $2',
          params: [today],
          from: today,
          to: today,
        };
    }
  }
}
