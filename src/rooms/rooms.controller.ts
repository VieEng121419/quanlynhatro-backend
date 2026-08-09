import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { GetRoomsQueryDto } from './dto/get-room.dto';
import { BulkCreateRoomDto } from './dto/bulk-create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('room')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN)
  async bulkCreateRooms(@Body() dto: BulkCreateRoomDto) {
    const result = await this.roomsService.bulkCreate(dto);
    return {
      success: true,
      statusCode: 201,
      data: result,
    };
  }

  @Put(':id')
  @Roles(Role.ADMIN)
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

  @Get('my-room')
  @Roles(Role.ADMIN, Role.STAFF, Role.TENANT)
  async getMyRoom(@CurrentUser('id') userId: number) {
    const room = await this.roomsService.getMyRoom(userId);

    return {
      success: true,
      statusCode: 200,
      data: room,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.TENANT)
  async getRoomById(@Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.getRoomById(id);

    return {
      success: true,
      statusCode: 200,
      data: room,
    };
  }
}
