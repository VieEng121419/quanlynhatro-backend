import { Controller, Get } from '@nestjs/common';
import { BranchsService } from './branchs.service';

@Controller('branchs')
export class BranchsController {
  constructor(private readonly branchsService: BranchsService) {}

  @Get()
  async getAllBranchs() {
    const data = await this.branchsService.findAll();
    return {
      success: true,
      statusCode: 200,
      message: 'Branchs retrieved successfully',
      data,
    };
  }
}
