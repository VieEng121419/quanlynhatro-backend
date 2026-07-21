import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { GetRoomsQueryDto } from './dto/get-room.dto';
import { BulkCreateRoomDto } from './dto/bulk-create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('room')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async getRooms(@Query() query: GetRoomsQueryDto) {
    const data = await this.roomsService.findAll(query);
    return {
      success: true,
      statusCode: 200,
      data,
    };
  }

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const data = await this.roomsService.create(createRoomDto);
    return {
      success: true,
      statusCode: 201,
      message: 'Đã tạo phòng mới thành công!',
      data,
    };
  }

  @Post('bulk')
  async bulkCreateRooms(@Body() dto: BulkCreateRoomDto) {
    const result = await this.roomsService.bulkCreate(dto);
    return {
      success: true,
      statusCode: 201,
      data: result,
    };
  }

  @Put(':id')
  async updateRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
  ) {
    const result = await this.roomsService.update(id, dto);
    return {
      success: true,
      statusCode: 200,
      message: `Cập nhật phòng #${id} thành công!`,
      data: result,
    };
  }
}
