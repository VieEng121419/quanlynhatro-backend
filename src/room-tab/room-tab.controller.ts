import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RoomTabService } from './room-tab.service';
import { GetRoomsDto } from './dto/get-room-tab.dto';
import { CreateRoomTabDto } from './dto/create-room-tab.dto';

@Controller('room-tab')
export class RoomTabController {
  constructor(private readonly roomTabService: RoomTabService) {}

  @Get()
  async getRooms(@Query() query: GetRoomsDto) {
    const result = await this.roomTabService.findAll(query);
    return {
      success: true,
      statusCode: 200,
      message: 'Lấy danh sách phòng thành công!',
      data: result.items,
      meta: result.meta,
    };
  }

  @Post()
  async createRoomTab(@Body() createRoomTabDto: CreateRoomTabDto) {
    const data = await this.roomTabService.create(createRoomTabDto);
    return {
      success: true,
      statusCode: 201,
      message: 'Đã tạo công nợ thành công!',
      data,
    };
  }
}
