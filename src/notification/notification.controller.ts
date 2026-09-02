import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { NotificationService } from './notification.service';

@Controller('notification')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.TENANT)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  @Get() list(
    @CurrentUser('id') userId: number,
    @Query() query: GetNotificationsDto,
  ) {
    return this.service.list(userId, query.limit, query.cursor);
  }
  @Get('unread-count') unread(@CurrentUser('id') userId: number) {
    return this.service.unreadCount(userId);
  }
  @Patch(':id/read') read(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.readOne(userId, id);
  }
  @Patch('read-all') readAll(@CurrentUser('id') userId: number) {
    return this.service.readAll(userId);
  }
  @Post('push-subscriptions') subscribe(
    @CurrentUser('id') userId: number,
    @Body() dto: PushSubscriptionDto,
  ) {
    return this.service.subscribe(userId, dto);
  }
  @Delete('push-subscriptions') remove(
    @CurrentUser('id') userId: number,
    @Body() dto: PushSubscriptionDto,
  ) {
    return this.service.removeSubscription(userId, dto.endpoint);
  }
}
