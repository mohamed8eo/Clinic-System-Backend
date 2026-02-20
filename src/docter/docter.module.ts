import { Module } from '@nestjs/common';
import { DocterService } from './docter.service';
import { DocterController } from './docter.controller';

@Module({
  controllers: [DocterController],
  providers: [DocterService],
})
export class DocterModule {}
// **5. All API Endpoints Summary**
/*`
GET  /doctor/dashboard               → Dashboard stats cards
GET  /doctor/appointments/today      → Today's appointments + patient info
GET  /doctor/appointments/week       → This week grouped by day
GET  /doctor/appointments/month      → This month grouped by day
GET  /doctor/slots?date=2026-02-20   → Available time slots for a date
POST /doctor/block-time              → Block a time or full day
DELETE /doctor/block-time/:id        → Unblock a time
GET  /doctor/block-time              → Get all upcoming blocked times
GET  /doctor/report?period=day       → Report (day/week/month/year)
PATCH /doctor/appointments/:id/status → Update appointment status
    */
