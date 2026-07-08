import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Controller('contract')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
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
  async updateContract(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    const result = await this.contractService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Cập nhật hợp đồng #${id} thành công!`,
      data: result,
    };
  }
}
