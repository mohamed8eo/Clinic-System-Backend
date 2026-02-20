import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserOAuthDto } from './dto/CreateUserOAuth.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './types/jwtPayload';
import RefreshTokenConfig from './config/RefreshToken-config';
import * as argon2 from 'argon2';
import type { ConfigType } from '@nestjs/config';
import { SignUpPatientDto } from './dto/SignUpPatients.dto';
import { SignUpDoctorDto } from './dto/SignUpDocter.dto';
import { LogInDto } from './dto/LogIn.dto';
import { AfterSocailSign } from './dto/AfterUserSignwithSocail.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(RefreshTokenConfig.KEY)
    private refreshConfig: ConfigType<typeof RefreshTokenConfig>,
    private db: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(googleUser: CreateUserOAuthDto) {
    // Check if user exists in patients table
    const existingPatient = await this.db.queryOne(
      'SELECT * FROM patients WHERE email = $1',
      [googleUser.email],
    );

    if (existingPatient) {
      return {
        ...existingPatient,
        role: 'patient',
      };
    }

    // Check if user exists in doctors table
    const existingDoctor = await this.db.queryOne(
      'SELECT * FROM doctors WHERE email = $1',
      [googleUser.email],
    );

    if (existingDoctor) {
      return {
        ...existingDoctor,
        role: 'doctor',
      };
    }

    const newPatient = await this.db.queryOne(
      `INSERT INTO patients (
      email,           
      password_hash,   
      full_name,       
      profile_picture, 
      created_at,      
      updated_at       
    ) VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING *`,
      [
        googleUser.email, // $1
        '', // $2
        googleUser.name, // $3
        googleUser.picture, // $4
        new Date(), // $5
        new Date(), // $6
      ],
    );

    return { ...newPatient, role: 'patient' };
  }

  async validateGithubUser(githubUser: CreateUserOAuthDto) {
    // Check if user exists in patients table
    const existingPatient = await this.db.queryOne(
      'SELECT * FROM patients WHERE email = $1',
      [githubUser.email],
    );

    if (existingPatient) {
      return {
        ...existingPatient,
        role: 'patient',
      };
    }

    // Check if user exists in doctors table
    const existingDoctor = await this.db.queryOne(
      'SELECT * FROM doctors WHERE email = $1',
      [githubUser.email],
    );

    if (existingDoctor) {
      return {
        ...existingDoctor,
        role: 'doctor',
      };
    }

    const newPatient = await this.db.queryOne(
      `INSERT INTO patients (
      email,           
      password_hash,   
      full_name,       
      profile_picture, 
      created_at,      
      updated_at       
    ) VALUES ($1, $2, $3, $4, $5, $6)  
    RETURNING *`,
      [
        githubUser.email, // $1
        '', // $2
        githubUser.name, // $3
        githubUser.picture, // $4
        new Date(), // $5
        new Date(), // $6
      ],
    );

    return { ...newPatient, role: 'patient' };
  }

  async logInOAuthUser(user: any) {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name || user.name || '',
      role: user.role,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name || user.name || '',
      role: user.role,
      type: 'refresh',
    };

    // Generate refresh token
    const { refreshToken, hashRefreshToken } =
      await this.generateRefreshToken(refreshPayload);

    // Insert refresh token into database
    await this.db.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        hashRefreshToken,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        new Date(),
      ],
    );

    return {
      accessToken: this.generateAccessToken(accessPayload),
      refreshToken,
    };
  }

  async completeSocialProfile(dto: AfterSocailSign, userId: number) {
    // 1. Normalize phone number
    const normalizedPhone = dto.phone.trim();

    // 2. Check if phone number already exists in patients table
    const existingPatientPhone = await this.db.queryOne(
      'SELECT id, phone FROM patients WHERE phone = $1 AND id != $2',
      [normalizedPhone, userId],
    );

    if (existingPatientPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    // 3. Check if phone number exists in doctors table
    const existingDoctorPhone = await this.db.queryOne(
      'SELECT id, phone FROM doctors WHERE phone = $1',
      [normalizedPhone],
    );

    if (existingDoctorPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    // 4. Validate date of birth (must be in the past and user must be at least 1 year old)
    const dateOfBirth = new Date(dto.dateOfBirth);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (dateOfBirth > oneYearAgo) {
      throw new BadRequestException('Invalid date of birth');
    }

    // 5. Check if user exists and is a patient (OAuth users are created as patients)
    const existingUser = await this.db.queryOne(
      'SELECT id, email, full_name FROM patients WHERE id = $1',
      [userId],
    );

    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    // 6. Update patient profile with additional information
    try {
      const updatedPatient = await this.db.queryOne(
        `UPDATE patients 
       SET phone = $1, 
           date_of_birth = $2, 
           gender = $3, 
           address = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, full_name, phone, date_of_birth, gender, address, created_at, updated_at`,
        [
          normalizedPhone,
          dto.dateOfBirth,
          dto.gender,
          dto.address?.trim() || null,
          userId,
        ],
      );

      // 7. Return updated user data
      return {
        success: true,
        message: 'Profile completed successfully',
        user: {
          id: updatedPatient.id,
          email: updatedPatient.email,
          fullName: updatedPatient.full_name,
          phone: updatedPatient.phone,
          dateOfBirth: updatedPatient.date_of_birth,
          gender: updatedPatient.gender,
          address: updatedPatient.address,
          role: 'patient',
          createdAt: updatedPatient.created_at,
          updatedAt: updatedPatient.updated_at,
        },
      };
    } catch (error) {
      console.error('Error updating patient profile:', error);

      // Handle unique constraint violation
      if (error.code === '23505') {
        if (error.constraint === 'patients_phone_unique') {
          throw new ConflictException('Phone number is already registered');
        }
      }

      throw new BadRequestException('Failed to update profile');
    }
  }
  // ============================================
  // Sign up Patient (WITH TOKENS)
  // ============================================
  async signUpPatient(dto: SignUpPatientDto) {
    // 1. Check if email already exists in patients table
    const existingPatient = await this.db.queryOne(
      'SELECT id, email FROM patients WHERE email = $1',
      [dto.email],
    );

    if (existingPatient) {
      throw new ConflictException('Email is already registered as a patient');
    }

    // 2. Check if email exists in doctors table (prevent duplicate across tables)
    const existingDoctor = await this.db.queryOne(
      'SELECT id, email FROM doctors WHERE email = $1',
      [dto.email],
    );

    if (existingDoctor) {
      throw new ConflictException('Email is already registered as a doctor');
    }

    // 3. Hash password
    const hashedPassword = await argon2.hash(dto.password);

    // 4. Validate date of birth (must be in the past and user must be at least 1 year old)
    const dateOfBirth = new Date(dto.dateOfBirth);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (dateOfBirth > oneYearAgo) {
      throw new BadRequestException('Invalid date of birth');
    }

    // 5. Insert new patient into database
    try {
      const newPatient = await this.db.queryOne(
        `INSERT INTO patients (
          email, 
          password_hash, 
          full_name, 
          phone,
          date_of_birth,
          gender,
          address,
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, full_name, phone, date_of_birth, gender, address, created_at`,
        [
          dto.email.toLowerCase().trim(), // Normalize email
          hashedPassword,
          dto.fullName.trim(),
          dto.phone.trim(),
          dto.dateOfBirth,
          dto.gender,
          dto.address?.trim() || null,
          new Date(),
          new Date(),
        ],
      );

      // 6. Generate access token
      const accessPayload: JwtPayload = {
        sub: newPatient.id,
        email: newPatient.email,
        fullName: newPatient.full_name,
        role: 'patient',
        type: 'access',
      };

      const accessToken = this.generateAccessToken(accessPayload);

      // 7. Generate refresh token
      const refreshPayload: JwtPayload = {
        sub: newPatient.id,
        email: newPatient.email,
        fullName: newPatient.full_name,
        role: 'patient',
        type: 'refresh',
      };

      const { refreshToken, hashRefreshToken } =
        await this.generateRefreshToken(refreshPayload);

      // 8. Store refresh token in database
      await this.db.execute(
        `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
         VALUES ($1, $2, $3, $4)`,
        [
          newPatient.id,
          hashRefreshToken,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          new Date(),
        ],
      );

      // 9. Return tokens and patient data WITHOUT password
      return {
        accessToken,
        refreshToken,
        user: {
          id: newPatient.id,
          email: newPatient.email,
          fullName: newPatient.full_name,
          phone: newPatient.phone,
          dateOfBirth: newPatient.date_of_birth,
          gender: newPatient.gender,
          address: newPatient.address,
          role: 'patient',
          createdAt: newPatient.created_at,
        },
      };
    } catch (error) {
      // Handle database errors
      console.error('Error creating patient:', error);
      throw new BadRequestException('Failed to create patient account');
    }
  }

  // ============================================
  // Sign up Doctor (WITH TOKENS)
  // ============================================
  async signUpDoctor(dto: SignUpDoctorDto) {
    // 1. Check if email already exists in doctors table
    const existingDoctor = await this.db.queryOne(
      'SELECT id, email FROM doctors WHERE email = $1',
      [dto.email],
    );

    if (existingDoctor) {
      throw new ConflictException('Email is already registered as a doctor');
    }

    // 2. Check if email exists in patients table
    const existingPatient = await this.db.queryOne(
      'SELECT id, email FROM patients WHERE email = $1',
      [dto.email],
    );

    if (existingPatient) {
      throw new ConflictException('Email is already registered as a patient');
    }

    // 3. Check if license number already exists
    const existingLicense = await this.db.queryOne(
      'SELECT id, license_number FROM doctors WHERE license_number = $1',
      [dto.licenseNumber],
    );

    if (existingLicense) {
      throw new ConflictException('License number is already registered');
    }

    // 4. Hash password
    const hashedPassword = await argon2.hash(dto.password);

    // 5. Insert new doctor into database
    try {
      const newDoctor = await this.db.queryOne(
        `INSERT INTO doctors (
          email, 
          password_hash, 
          full_name, 
          phone,
          specialization,
          license_number,
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, full_name, phone, specialization, license_number, created_at`,
        [
          dto.email.toLowerCase().trim(),
          hashedPassword,
          dto.fullName.trim(),
          dto.phone.trim(),
          dto.specialization.trim(),
          dto.licenseNumber.toUpperCase().trim(),
          new Date(),
          new Date(),
        ],
      );

      // 6. Generate access token
      const accessPayload: JwtPayload = {
        sub: newDoctor.id,
        email: newDoctor.email,
        fullName: newDoctor.full_name,
        role: 'doctor',
        type: 'access',
      };

      const accessToken = this.generateAccessToken(accessPayload);

      // 7. Generate refresh token
      const refreshPayload: JwtPayload = {
        sub: newDoctor.id,
        email: newDoctor.email,
        fullName: newDoctor.full_name,
        role: 'doctor',
        type: 'refresh',
      };

      const { refreshToken, hashRefreshToken } =
        await this.generateRefreshToken(refreshPayload);

      // 8. Store refresh token in database
      await this.db.execute(
        `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
         VALUES ($1, $2, $3, $4)`,
        [
          newDoctor.id,
          hashRefreshToken,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          new Date(),
        ],
      );

      // 9. Return tokens and doctor data WITHOUT password
      return {
        accessToken,
        refreshToken,
        user: {
          id: newDoctor.id,
          email: newDoctor.email,
          fullName: newDoctor.full_name,
          phone: newDoctor.phone,
          specialization: newDoctor.specialization,
          licenseNumber: newDoctor.license_number,
          role: 'doctor',
          createdAt: newDoctor.created_at,
        },
      };
    } catch (error) {
      console.error('Error creating doctor:', error);
      throw new BadRequestException('Failed to create doctor account');
    }
  }

  // ============================================
  // Login
  // ============================================
  async logIn(dto: LogInDto) {
    const { email, password } = dto;

    // 1. Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if user exists in patients table
    let user = await this.db.queryOne(
      'SELECT id, email, password_hash, full_name FROM patients WHERE email = $1',
      [normalizedEmail],
    );

    let role = 'patient';

    // 3. If not found in patients, check doctors table
    if (!user) {
      user = await this.db.queryOne(
        'SELECT id, email, password_hash, full_name FROM doctors WHERE email = $1',
        [normalizedEmail],
      );
      role = 'doctor';
    }

    // 4. If user not found in either table
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 5. Verify password
    let isPasswordValid = false;
    try {
      isPasswordValid = await argon2.verify(user.password_hash, password);
    } catch (error) {
      console.error('Password verification error:', error);
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 6. Delete all existing refresh tokens for this user
    await this.db.execute('DELETE FROM refresh_tokens WHERE user_id = $1', [
      user.id,
    ]);

    // 7. Generate new access token
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: role,
      type: 'access',
    };

    const accessToken = this.generateAccessToken(accessPayload);

    // 8. Generate new refresh token
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: role,
      type: 'refresh',
    };

    const { refreshToken, hashRefreshToken } =
      await this.generateRefreshToken(refreshPayload);

    // 9. Store new refresh token in database
    await this.db.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        user.id,
        hashRefreshToken,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        new Date(),
      ],
    );

    // 10. Return tokens and user info (without password)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: role,
      },
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(payload: JwtPayload): Promise<{
    refreshToken: string;
    hashRefreshToken: string;
  }> {
    const refreshToken = this.jwtService.sign(payload, this.refreshConfig);
    const hashRefreshToken = await argon2.hash(refreshToken);

    return {
      refreshToken,
      hashRefreshToken,
    };
  }

  async refreshAccessToken(userId: number, refreshToken: string) {
    // 1. Find refresh token record
    const tokenRecord = await this.db.queryOne(
      `SELECT * FROM refresh_tokens 
     WHERE user_id = $1 
     AND revoked = false 
     AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
      [userId],
    );

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    // 2. Verify hash
    let isValid = false;
    try {
      isValid = await argon2.verify(tokenRecord.token, refreshToken);
    } catch (error) {
      console.error('Token verification error:', error);
      isValid = false;
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 3. Calculate remaining time
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);

    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

    let newRefreshToken: string | null = null;

    // 4. Get user first (needed for refresh token rotation)
    let user = await this.db.queryOne(
      'SELECT id, email, full_name FROM patients WHERE id = $1',
      [userId],
    );

    let role = 'patient';

    if (!user) {
      user = await this.db.queryOne(
        'SELECT id, email, full_name FROM doctors WHERE id = $1',
        [userId],
      );
      role = 'doctor';
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 5. If remaining <= 7 days → rotate refresh token
    if (remainingDays <= 7) {
      // Delete old token
      await this.db.execute(`DELETE FROM refresh_tokens WHERE id = $1`, [
        tokenRecord.id,
      ]);

      // Generate new refresh token
      const refreshPayload: JwtPayload = {
        sub: userId.toString(),
        email: user.email,
        fullName: user.full_name,
        role: role,
        type: 'refresh',
      };

      const { refreshToken: freshToken, hashRefreshToken } =
        await this.generateRefreshToken(refreshPayload);

      // Store new one
      await this.db.execute(
        `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
        [
          userId,
          hashRefreshToken,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          new Date(),
        ],
      );

      newRefreshToken = freshToken;
    }

    // 6. Generate new access token
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: role,
      type: 'access',
    };

    const accessToken = this.generateAccessToken(accessPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken, // will be null if not rotated
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role,
      },
    };
  }
}

/*
 * User Sign With Google OR GitHub
 *  How the flow will be ?
 *  1- sign with any provider
 *  take her info and wait it to chose her if he patient or doctor
 * */
