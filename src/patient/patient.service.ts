import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Injectable()
export class PatientService {
  constructor(private db: DatabaseService) {}

  // ============================================
  // GET ALL PATIENT BOOKINGS
  // ============================================
  async getAllBookings(patientId: number) {
    const bookings = await this.db.query(
      `SELECT 
        a.id,
        a.appointment_code,
        a.appointment_date,
        a.appointment_time,
        a.status,
        a.reason_for_visit,
        a.notes,
        a.created_at,
        d.id         AS doctor_id,
        d.full_name  AS doctor_name,
        d.email      AS doctor_email,
        d.phone      AS doctor_phone,
        d.specialization
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [patientId],
    );

    // Split into upcoming and past
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().substring(0, 5);

    const upcoming = bookings.filter((b) => {
      const bookingDate = b.appointment_date.toISOString().split('T')[0];
      const bookingTime = b.appointment_time.substring(0, 5);
      return (
        bookingDate > today ||
        (bookingDate === today && bookingTime > currentTime)
      );
    });

    const past = bookings.filter((b) => {
      const bookingDate = b.appointment_date.toISOString().split('T')[0];
      const bookingTime = b.appointment_time.substring(0, 5);
      return (
        bookingDate < today ||
        (bookingDate === today && bookingTime <= currentTime)
      );
    });

    return {
      total: bookings.length,
      upcoming: {
        count: upcoming.length,
        bookings: upcoming.map((b) => this.formatBooking(b)),
      },
      past: {
        count: past.length,
        bookings: past.map((b) => this.formatBooking(b)),
      },
    };
  }

  // ============================================
  // GET SINGLE BOOKING DETAILS
  // ============================================
  async getBookingById(patientId: number, bookingId: number) {
    const booking = await this.db.queryOne(
      `SELECT 
        a.id,
        a.appointment_code,
        a.appointment_date,
        a.appointment_time,
        a.status,
        a.reason_for_visit,
        a.notes,
        a.created_at,
        d.id         AS doctor_id,
        d.full_name  AS doctor_name,
        d.email      AS doctor_email,
        d.phone      AS doctor_phone,
        d.specialization
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1 AND a.patient_id = $2`,
      [bookingId, patientId],
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.formatBooking(booking);
  }

  // ============================================
  // GET DOCTORS BY SPECIALIZATION
  // ============================================
  async getDoctorsBySpecialization(specialization: string) {
    const doctors = await this.db.query(
      `SELECT 
        id,
        full_name,
        email,
        phone,
        specialization
       FROM doctors
       WHERE LOWER(specialization) = LOWER($1)
       ORDER BY full_name ASC`,
      [specialization],
    );

    if (doctors.length === 0) {
      throw new NotFoundException(
        `No doctors found for specialization: ${specialization}`,
      );
    }

    return {
      specialization,
      totalDoctors: doctors.length,
      doctors: doctors.map((d) => ({
        id: d.id,
        name: d.full_name,
        email: d.email,
        phone: d.phone,
        specialization: d.specialization,
      })),
    };
  }

  // ============================================
  // GET ALL SPECIALIZATIONS
  // ============================================
  async getAllSpecializations() {
    const specializations = await this.db.query(
      `SELECT 
        specialization,
        COUNT(*) AS doctor_count
       FROM doctors
       GROUP BY specialization
       ORDER BY specialization ASC`,
      [],
    );

    return {
      total: specializations.length,
      specializations: specializations.map((s) => ({
        name: s.specialization,
        doctorCount: parseInt(s.doctor_count),
      })),
    };
  }

  // ============================================
  // GET FREE TIME SLOTS FOR A DOCTOR
  // ============================================
  async getDoctorFreeSlots(doctorId: number, date: string) {
    // 1. Validate doctor exists
    const doctor = await this.db.queryOne(
      'SELECT id, full_name, specialization FROM doctors WHERE id = $1',
      [doctorId],
    );

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // 2. Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      throw new BadRequestException('Cannot check slots for past dates');
    }

    // 3. Check if day is fully blocked
    const fullDayBlock = await this.db.queryOne(
      `SELECT id FROM blocked_times 
       WHERE doctor_id = $1 
       AND blocked_date = $2 
       AND is_full_day = true`,
      [doctorId, date],
    );

    if (fullDayBlock) {
      return {
        date,
        doctor: {
          id: doctor.id,
          name: doctor.full_name,
          specialization: doctor.specialization,
        },
        available: false,
        message: 'Doctor is not available on this day',
        slots: [],
      };
    }

    // 4. Get booked slots
    const bookedSlots = await this.db.query(
      `SELECT appointment_time 
       FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2
       AND status NOT IN ('cancelled')`,
      [doctorId, date],
    );

    // 5. Get partially blocked times
    const blockedTimes = await this.db.query(
      `SELECT start_time, end_time 
       FROM blocked_times
       WHERE doctor_id = $1 
       AND blocked_date = $2
       AND is_full_day = false`,
      [doctorId, date],
    );

    // 6. Generate all possible slots (9 AM - 5 PM, 30 min intervals)
    const allSlots = this.generateTimeSlots('09:00', '17:00', 30);

    // 7. Filter available slots
    const bookedTimes = bookedSlots.map((b) =>
      b.appointment_time.substring(0, 5),
    );

    const availableSlots = allSlots.filter((slot) => {
      // Is slot booked?
      if (bookedTimes.includes(slot)) return false;

      // Is slot in a blocked range?
      const isBlocked = blockedTimes.some(
        (bt) =>
          slot >= bt.start_time.substring(0, 5) &&
          slot < bt.end_time.substring(0, 5),
      );

      return !isBlocked;
    });

    return {
      date,
      doctor: {
        id: doctor.id,
        name: doctor.full_name,
        specialization: doctor.specialization,
      },
      available: true,
      totalSlots: allSlots.length,
      availableCount: availableSlots.length,
      bookedCount: bookedTimes.length,
      slots: availableSlots.map((time) => ({
        time,
        display: this.formatTime(time),
      })),
    };
  }

  // ============================================
  // CREATE BOOKING
  // ============================================
  async createBooking(patientId: number, dto: CreateBookingDto) {
    // 1. Validate doctor exists
    const doctor = await this.db.queryOne(
      'SELECT id, full_name, specialization FROM doctors WHERE id = $1',
      [dto.doctorId],
    );

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // 2. Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (dto.appointmentDate < today) {
      throw new BadRequestException('Cannot book appointments in the past');
    }

    // 3. Check if slot is available
    const existingBooking = await this.db.queryOne(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND appointment_time = $3
       AND status NOT IN ('cancelled')`,
      [dto.doctorId, dto.appointmentDate, dto.appointmentTime],
    );

    if (existingBooking) {
      throw new ConflictException(
        'This time slot is already booked. Please choose another time.',
      );
    }

    // 4. Check if time is in a blocked range
    const isBlocked = await this.db.queryOne(
      `SELECT id FROM blocked_times
       WHERE doctor_id = $1
       AND blocked_date = $2
       AND (
         is_full_day = true
         OR ($3 >= start_time AND $3 < end_time)
       )`,
      [dto.doctorId, dto.appointmentDate, dto.appointmentTime],
    );

    if (isBlocked) {
      throw new BadRequestException(
        'Doctor is not available at this time. Please choose another slot.',
      );
    }

    // 5. Check patient doesn't already have booking at same time
    const patientConflict = await this.db.queryOne(
      `SELECT id FROM appointments
       WHERE patient_id = $1
       AND appointment_date = $2
       AND appointment_time = $3
       AND status NOT IN ('cancelled')`,
      [patientId, dto.appointmentDate, dto.appointmentTime],
    );

    if (patientConflict) {
      throw new ConflictException(
        'You already have an appointment at this time.',
      );
    }

    // 6. Generate unique appointment code
    const appointmentCode = await this.generateAppointmentCode();

    // 7. Create the booking
    const newBooking = await this.db.queryOne(
      `INSERT INTO appointments (
        appointment_code,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        status,
        reason_for_visit,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'booked', $6, NOW(), NOW())
      RETURNING *`,
      [
        appointmentCode,
        patientId,
        dto.doctorId,
        dto.appointmentDate,
        dto.appointmentTime,
        dto.reasonForVisit || null,
      ],
    );

    return {
      success: true,
      message: 'Appointment booked successfully',
      booking: {
        id: newBooking.id,
        code: newBooking.appointment_code,
        date: newBooking.appointment_date,
        time: this.formatTime(newBooking.appointment_time.substring(0, 5)),
        status: newBooking.status,
        reasonForVisit: newBooking.reason_for_visit,
        doctor: {
          id: doctor.id,
          name: doctor.full_name,
          specialization: doctor.specialization,
        },
      },
    };
  }

  // ============================================
  // UPDATE BOOKING
  // ============================================
  async updateBooking(
    patientId: number,
    bookingId: number,
    dto: UpdateBookingDto,
  ) {
    // 1. Find the booking
    const booking = await this.db.queryOne(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2',
      [bookingId, patientId],
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 2. Check booking is not cancelled or completed
    if (['cancelled', 'completed'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot update a ${booking.status} appointment`,
      );
    }

    // 3. Check if it's at least 2 hours before the appointment
    this.validateTimeRestriction(booking);

    const newDate = dto.appointmentDate || booking.appointment_date;
    const newTime = dto.appointmentTime || booking.appointment_time;

    // 4. Check new slot is available (if changing date or time)
    if (dto.appointmentDate || dto.appointmentTime) {
      const slotTaken = await this.db.queryOne(
        `SELECT id FROM appointments 
         WHERE doctor_id = $1 
         AND appointment_date = $2 
         AND appointment_time = $3
         AND status NOT IN ('cancelled')
         AND id != $4`,
        [booking.doctor_id, newDate, newTime, bookingId],
      );

      if (slotTaken) {
        throw new ConflictException(
          'This time slot is already booked. Please choose another time.',
        );
      }

      // 5. Check new slot is not blocked
      const isBlocked = await this.db.queryOne(
        `SELECT id FROM blocked_times
         WHERE doctor_id = $1
         AND blocked_date = $2
         AND (
           is_full_day = true
           OR ($3 >= start_time AND $3 < end_time)
         )`,
        [booking.doctor_id, newDate, newTime],
      );

      if (isBlocked) {
        throw new BadRequestException(
          'Doctor is not available at this time. Please choose another slot.',
        );
      }
    }

    // 6. Update the booking
    const updatedBooking = await this.db.queryOne(
      `UPDATE appointments
       SET 
         appointment_date  = COALESCE($1, appointment_date),
         appointment_time  = COALESCE($2, appointment_time),
         reason_for_visit  = COALESCE($3, reason_for_visit),
         updated_at        = NOW()
       WHERE id = $4 AND patient_id = $5
       RETURNING *`,
      [
        dto.appointmentDate || null,
        dto.appointmentTime || null,
        dto.reasonForVisit || null,
        bookingId,
        patientId,
      ],
    );

    return {
      success: true,
      message: 'Appointment updated successfully',
      booking: this.formatBooking(updatedBooking),
    };
  }

  // ============================================
  // DELETE BOOKING
  // ============================================
  async deleteBooking(patientId: number, bookingId: number) {
    // 1. Find the booking
    const booking = await this.db.queryOne(
      'SELECT * FROM appointments WHERE id = $1 AND patient_id = $2',
      [bookingId, patientId],
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 2. Check booking is not already cancelled or completed
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    if (booking.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }

    // 3. Check if it's at least 2 hours before the appointment
    this.validateTimeRestriction(booking);

    // 4. Cancel the booking (soft delete)
    await this.db.execute(
      `UPDATE appointments
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2`,
      [bookingId, patientId],
    );

    return {
      success: true,
      message: 'Appointment cancelled successfully',
      cancelledAt: new Date(),
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  // Validate 2 hour restriction
  private validateTimeRestriction(booking: any) {
    const bookingDate =
      booking.appointment_date instanceof Date
        ? booking.appointment_date.toISOString().split('T')[0]
        : booking.appointment_date;

    const bookingTime = booking.appointment_time.substring(0, 5);
    const appointmentDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (appointmentDateTime <= twoHoursFromNow) {
      throw new ForbiddenException(
        'You can only modify appointments at least 2 hours before the scheduled time',
      );
    }
  }

  // Format booking response
  private formatBooking(booking: any) {
    const bookingDate =
      booking.appointment_date instanceof Date
        ? booking.appointment_date.toISOString().split('T')[0]
        : booking.appointment_date;

    return {
      id: booking.id,
      code: booking.appointment_code,
      date: bookingDate,
      time: this.formatTime(booking.appointment_time?.substring(0, 5)),
      rawTime: booking.appointment_time,
      status: booking.status,
      statusBadge: this.getStatusBadge(booking.status),
      reasonForVisit: booking.reason_for_visit,
      notes: booking.notes,
      createdAt: booking.created_at,
      doctor: {
        id: booking.doctor_id,
        name: booking.doctor_name,
        email: booking.doctor_email,
        phone: booking.doctor_phone,
        specialization: booking.specialization,
      },
    };
  }

  // Generate unique appointment code
  private async generateAppointmentCode(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const code = `APT-${timestamp}-${random}`;

    // Check if code already exists
    const existing = await this.db.queryOne(
      'SELECT id FROM appointments WHERE appointment_code = $1',
      [code],
    );

    // Recursively generate new code if exists
    if (existing) {
      return this.generateAppointmentCode();
    }

    return code;
  }

  // Format time to 12h format
  private formatTime(time: string): string {
    if (!time) return '';
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  }

  // Get status badge info
  private getStatusBadge(status: string) {
    const badges: Record<string, { color: string; label: string }> = {
      booked: { color: 'blue', label: 'Booked' },
      confirmed: { color: 'teal', label: 'Confirmed' },
      completed: { color: 'green', label: 'Completed' },
      cancelled: { color: 'red', label: 'Cancelled' },
      no_show: { color: 'gray', label: 'No Show' },
    };
    return badges[status] || { color: 'gray', label: status };
  }

  // Generate time slots
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

  // ============================================
  // GET PATIENT PROFILE
  // ============================================
  async getProfile(patientId: number) {
    const patient = await this.db.queryOne(
      `SELECT 
      id,
      email,
      full_name,
      phone,
      date_of_birth,
      gender,
      address,
      profile_picture,
      created_at,
      updated_at
     FROM patients 
     WHERE id = $1`,
      [patientId],
    );

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Calculate age from date of birth
    const age = this.calculateAge(patient.date_of_birth);

    return {
      id: patient.id,
      email: patient.email,
      fullName: patient.full_name,
      phone: patient.phone,
      dateOfBirth: patient.date_of_birth,
      age: age,
      gender: patient.gender,
      address: patient.address,
      profilePicture: patient.profile_picture,
      role: 'patient',
      createdAt: patient.created_at,
      updatedAt: patient.updated_at,
    };
  }

  // ============================================
  // GET PATIENT STATISTICS
  // ============================================
  async getPatientStats(patientId: number) {
    // Get appointment statistics
    const stats = await this.db.queryOne(
      `SELECT
      COUNT(*) as total_appointments,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE status = 'booked') as booked,
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
      COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
      COUNT(DISTINCT doctor_id) as unique_doctors,
      COUNT(*) FILTER (
        WHERE appointment_date >= CURRENT_DATE
        AND status NOT IN ('cancelled', 'no_show')
      ) as upcoming_appointments,
      MIN(appointment_date) as first_appointment_date,
      MAX(appointment_date) as last_appointment_date
     FROM appointments
     WHERE patient_id = $1`,
      [patientId],
    );

    // Get most visited specializations
    const topSpecializations = await this.db.query(
      `SELECT 
      d.specialization,
      COUNT(*) as visit_count
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.patient_id = $1
     AND a.status = 'completed'
     GROUP BY d.specialization
     ORDER BY visit_count DESC
     LIMIT 3`,
      [patientId],
    );

    // Get most visited doctors
    const topDoctors = await this.db.query(
      `SELECT 
      d.id,
      d.full_name,
      d.specialization,
      d.profile_picture,
      COUNT(*) as visit_count
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.patient_id = $1
     AND a.status = 'completed'
     GROUP BY d.id, d.full_name, d.specialization, d.profile_picture
     ORDER BY visit_count DESC
     LIMIT 3`,
      [patientId],
    );

    return {
      appointments: {
        total: parseInt(stats.total_appointments) || 0,
        completed: parseInt(stats.completed) || 0,
        cancelled: parseInt(stats.cancelled) || 0,
        booked: parseInt(stats.booked) || 0,
        confirmed: parseInt(stats.confirmed) || 0,
        noShow: parseInt(stats.no_show) || 0,
        upcoming: parseInt(stats.upcoming_appointments) || 0,
      },
      doctors: {
        uniqueDoctorsVisited: parseInt(stats.unique_doctors) || 0,
        topDoctors: topDoctors.map((d) => ({
          id: d.id,
          name: d.full_name,
          specialization: d.specialization,
          profilePicture: d.profile_picture,
          visitCount: parseInt(d.visit_count),
        })),
      },
      specializations: {
        topSpecializations: topSpecializations.map((s) => ({
          name: s.specialization,
          visitCount: parseInt(s.visit_count),
        })),
      },
      timeline: {
        firstAppointment: stats.first_appointment_date,
        lastAppointment: stats.last_appointment_date,
        memberSince: null, // Will be added from patient created_at
      },
    };
  }

  // ============================================
  // GET COMPLETE PATIENT INFO (Profile + Stats)
  // ============================================
  async getCompletePatientInfo(patientId: number) {
    // Get profile
    const profile = await this.getProfile(patientId);

    // Get statistics
    const stats = await this.getPatientStats(patientId);

    // Add member since to timeline
    stats.timeline.memberSince = profile.createdAt;

    return {
      profile,
      statistics: stats,
    };
  }

  // ============================================
  // GET PATIENT MEDICAL HISTORY SUMMARY
  // ============================================
  async getMedicalHistorySummary(patientId: number) {
    // Get all completed appointments with notes
    const appointments = await this.db.query(
      `SELECT 
      a.id,
      a.appointment_date,
      a.appointment_time,
      a.reason_for_visit,
      a.notes,
      d.full_name as doctor_name,
      d.specialization
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.patient_id = $1
     AND a.status = 'completed'
     AND a.notes IS NOT NULL
     ORDER BY a.appointment_date DESC, a.appointment_time DESC
     LIMIT 10`,
      [patientId],
    );

    return {
      totalRecords: appointments.length,
      recentVisits: appointments.map((apt) => ({
        id: apt.id,
        date: apt.appointment_date,
        time: this.formatTime(apt.appointment_time?.substring(0, 5)),
        reasonForVisit: apt.reason_for_visit,
        doctorNotes: apt.notes,
        doctor: {
          name: apt.doctor_name,
          specialization: apt.specialization,
        },
      })),
    };
  }

  // ============================================
  // UPDATE PATIENT PROFILE
  // ============================================
  async updateProfile(
    patientId: number,
    updateData: {
      fullName?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: string;
      address?: string;
    },
  ) {
    // Verify patient exists
    await this.getProfile(patientId);

    // Build dynamic update query
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let paramCount = 1;

    if (updateData.fullName) {
      fields.push(`full_name = $${paramCount++}`);
      values.push(updateData.fullName.trim());
    }
    if (updateData.phone) {
      fields.push(`phone = $${paramCount++}`);
      values.push(updateData.phone.trim());
    }
    if (updateData.dateOfBirth) {
      fields.push(`date_of_birth = $${paramCount++}`);
      values.push(updateData.dateOfBirth);
    }
    if (updateData.gender) {
      fields.push(`gender = $${paramCount++}`);
      values.push(updateData.gender);
    }
    if (updateData.address !== undefined) {
      fields.push(`address = $${paramCount++}`);
      values.push(updateData.address?.trim() || null);
    }

    if (fields.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    values.push(patientId);
    const sql = `
    UPDATE patients 
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING id, email, full_name, phone, date_of_birth, gender, address, profile_picture, created_at, updated_at
  `;

    const updated = await this.db.queryOne(sql, values);

    const age = this.calculateAge(updated.date_of_birth);

    return {
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updated.id,
        email: updated.email,
        fullName: updated.full_name,
        phone: updated.phone,
        dateOfBirth: updated.date_of_birth,
        age: age,
        gender: updated.gender,
        address: updated.address,
        profilePicture: updated.profile_picture,
        role: 'patient',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    };
  }

  // ============================================
  // UPDATE PROFILE PICTURE
  // ============================================
  async updateProfilePicture(patientId: number, imageUrl: string) {
    const updated = await this.db.queryOne(
      `UPDATE patients 
     SET profile_picture = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, full_name, profile_picture`,
      [imageUrl, patientId],
    );

    if (!updated) {
      throw new NotFoundException('Patient not found');
    }

    return {
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: updated.profile_picture,
    };
  }

  // ============================================
  // DELETE PROFILE PICTURE
  // ============================================
  async deleteProfilePicture(patientId: number) {
    const updated = await this.db.queryOne(
      `UPDATE patients 
     SET profile_picture = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
      [patientId],
    );

    if (!updated) {
      throw new NotFoundException('Patient not found');
    }

    return {
      success: true,
      message: 'Profile picture removed successfully',
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  // Calculate age from date of birth
  private calculateAge(dateOfBirth: Date | string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  }
}
