import { Body, Controller, Get, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Controller('room')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    const data = await this.roomsService.findAll();
    return {
      success: true,
      statusCode: 200,
      message: 'Rooms retrieved successfully',
      data,
    };
  }

  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const data = await this.roomsService.create(createRoomDto);
    return {
      success: true,
      statusCode: 201,
      message: 'Room created successfully',
      data,
    };
  }
}
