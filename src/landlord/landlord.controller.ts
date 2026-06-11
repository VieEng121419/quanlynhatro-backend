import { Controller, Get } from '@nestjs/common';
import { LandlordService } from './landlord.service';

@Controller('landlord')
export class LandlordController {
  constructor(private readonly landlordService: LandlordService) {}

  @Get()
  async getAllLandlords() {
    const data = await this.landlordService.findAll();
    return {
      success: true,
      statusCode: 200,
      message: 'Landlords retrieved successfully',
      data,
    };
  }
}
