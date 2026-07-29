import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('contract')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  private readonly logger = new Logger();

  @Post()
  @Roles(Role.ADMIN)
  async createContract(@Body() createContractDto: CreateContractDto) {
    const data = await this.contractService.create(createContractDto);
    return {
      success: true,
      statusCode: 201,
      message: 'Tạo hợp đồng và nhận phòng thành công',
      data,
    };
  }

  @Post(':id/terminate')
  @Roles(Role.ADMIN)
  async terminate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TerminateContractDto,
  ) {
    const result = await this.contractService.terminate(id, dto);
    return {
      success: true,
      statusCode: 200,
      data: result,
    };
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async updateContract(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    this.logger.log('DTO CONTRLLER', dto);
    const result = await this.contractService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Cập nhật hợp đồng #${id} thành công!`,
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getContractDetail(@Param('id', ParseIntPipe) id: number) {
    const result = await this.contractService.findOne(id);
    return {
      success: true,
      statusCode: 200,
      message: `Lấy chi tiết hợp đồng #${id} thành công!`,
      data: result,
    };
  }
}
